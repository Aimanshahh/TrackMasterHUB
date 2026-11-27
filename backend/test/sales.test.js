import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';

before(async () => { if (hasDb) await connectTestDb(); });
after(async () => { if (hasDb) await closeTestDb(); });

test('routes: a salesperson sees only their own board, the company board is for admin and manager', async () => {
  const { salesRouter } = await import('../src/modules/sales/sales.routes.js');
  const run = (guard, role) => new Promise((resolve) => guard({ user: { role } }, {}, (err) => resolve(err ?? null)));
  const guardOf = (path) => salesRouter.stack.find((l) => l.route?.path === path).route.stack[0].handle;
  assert.equal(await run(guardOf('/mine'), 'salesperson'), null);
  assert.ok(await run(guardOf('/mine'), 'admin'));
  for (const role of ['admin', 'manager']) assert.equal(await run(guardOf('/overview'), role), null);
  for (const role of ['salesperson', 'operations']) assert.ok(await run(guardOf('/overview'), role));
});

test('the sales board counts sales, approvals and renewals for one salesperson or the whole company', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { getSalesBoard } = await import('../src/modules/sales/sales.service.js');

  const ali = await User.create({ name: 'Ali Sales', email: 'ali-sales@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const sara = await User.create({ name: 'Sara Sales', email: 'sara-sales@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const aliCustomer = await Customer.create({ name: 'Ali Customer', phone: '03001110000', owner: ali._id });
  const saraCustomer = await Customer.create({ name: 'Sara Customer', phone: '03002220000', owner: sara._id });

  const day = 86_400_000;
  const job = (user, customer, extra) => Job.create({
    createdBy: user._id, customer: customer._id, customerName: customer.name, requestType: 'new_installation',
    vehicle: { registration: 'SB-1' }, packageKey: 'basic', listPrice: 10000, quotedPrice: 10000, status: 'completed', ...extra,
  });

  await job(ali, aliCustomer, { amcExpiryDate: new Date(Date.now() - 5 * day) });
  await job(ali, aliCustomer, { quotedPrice: 8000, approvalStatus: 'pending', status: 'unassigned', amcExpiryDate: new Date(Date.now() + 200 * day) });
  await job(ali, aliCustomer, { status: 'cancelled' });
  await job(sara, saraCustomer, { amcExpiryDate: new Date(Date.now() + 10 * day) });

  const mine = await getSalesBoard({ ownerId: ali._id });
  assert.equal(mine.totals.sales, 2, 'cancelled requests are not sales');
  assert.equal(mine.totals.salesValue, undefined, 'money is not shown to the salesperson');
  assert.equal(mine.totals.monthValue, undefined);
  assert.ok(mine.recent.every((row) => row.quotedPrice === undefined && row.listPrice === undefined && row.discount === undefined));
  assert.equal(mine.totals.awaitingApproval, 1);
  assert.equal(mine.totals.renewalsDue, 1);
  assert.equal(mine.renewals[0].state, 'expired');
  assert.equal(mine.bySalesperson, undefined, 'a salesperson never sees the other salespeople');
  assert.ok(mine.recent.every((row) => row.customerName === 'Ali Customer'));

  const company = await getSalesBoard();
  assert.equal(company.totals.sales, 3);
  assert.equal(company.totals.salesValue, 28000, 'the company board still carries the quoted price');
  assert.equal(company.totals.renewalsDue, 2);
  assert.deepEqual(company.bySalesperson.map((row) => row.name).sort(), ['Ali Sales', 'Sara Sales']);
});

test('a sale can be cancelled with a reason and restored, and cancelled sales leave the active counts', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { getSalesBoard, cancelSale, restoreSale } = await import('../src/modules/sales/sales.service.js');

  const rep = await User.create({ name: 'Cancel Rep', email: 'cancel-rep@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const other = await User.create({ name: 'Other Rep', email: 'other-rep@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const customer = await Customer.create({ name: 'Cancel Customer', phone: '03003330000', owner: rep._id });
  const job = await Job.create({ createdBy: rep._id, customer: customer._id, customerName: customer.name, requestType: 'new_installation', vehicle: { registration: 'CAN-1' }, packageKey: 'basic', listPrice: 10000, quotedPrice: 10000, status: 'unassigned' });
  const actor = { id: rep._id.toString(), role: 'salesperson', name: 'Cancel Rep' };
  const { default: Notification } = await import('../src/models/Notification.js');
  const { default: Activity } = await import('../src/models/Activity.js');
  const admin = await User.create({ name: 'Cancel Admin', email: 'cancel-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });

  await assert.rejects(cancelSale(job._id, actor, { reason: 'nope' }), (e) => e.message.includes('why'));
  await assert.rejects(cancelSale(job._id, { id: other._id.toString(), role: 'salesperson' }, { reason: 'other' }), (e) => e.message.includes('could not be found'));

  await cancelSale(job._id, actor, { reason: 'technician_delayed', note: 'Waited two weeks' });
  let board = await getSalesBoard({ ownerId: rep._id });
  assert.equal(await Notification.countDocuments({ user: admin._id, type: 'sale.cancelled' }), 1, 'the admin is told');
  assert.equal(await Activity.countDocuments({ type: 'sale.cancelled' }), 1);
  assert.equal(board.totals.cancelled, 1);
  assert.equal(board.totals.sales, 0, 'a cancelled sale is not an installation');
  assert.equal(board.cancelled[0].cancellation.reasonLabel, 'Technician was delayed');
  assert.equal(board.cancelled[0].quotedPrice, undefined);
  await assert.rejects(cancelSale(job._id, actor, { reason: 'other' }), (e) => e.message.includes('already'));

  await restoreSale(job._id, actor);
  board = await getSalesBoard({ ownerId: rep._id });
  assert.equal(board.totals.cancelled, 0);
  assert.equal(board.totals.sales, 1);
  assert.equal((await Job.findById(job._id)).status, 'unassigned', 'restoring puts the job back where it was');
});

test('admin audit trail: role changes, new accounts, technician changes and price changes are recorded', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Activity } = await import('../src/models/Activity.js');
  const { createUser, changeRole } = await import('../src/modules/users/users.service.js');
  const admin = await User.create({ name: 'Audit Admin', email: 'audit-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const actor = { id: admin._id.toString(), name: 'Audit Admin', role: 'admin' };

  const made = await createUser({ name: 'New Person', email: 'new-person@example.com', password: 'a-long-test-password', role: 'salesperson' }, actor);
  await changeRole({ id: made.id, role: 'operations' }, actor);
  const lines = await Activity.find({ actor: admin._id }).sort({ createdAt: 1 });
  assert.deepEqual(lines.map((row) => row.type), ['user.created', 'user.role_changed']);
  assert.match(lines[1].description, /from salesperson to operations/);
});

test('monthly targets: only a whole number from 0 up is accepted, progress counts this month and skips cancelled sales', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { default: Activity } = await import('../src/models/Activity.js');
  const { setTarget } = await import('../src/modules/users/users.service.js');
  const { getSalesBoard, getMonthlyProgress } = await import('../src/modules/sales/sales.service.js');

  const admin = await User.create({ name: 'Target Admin', email: 'target-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const rep = await User.create({ name: 'Target Rep', email: 'target-rep@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const customer = await Customer.create({ name: 'Target Customer', phone: '03004440000', owner: rep._id });
  const job = (extra) => Job.create({ createdBy: rep._id, customer: customer._id, customerName: customer.name, requestType: 'new_installation', vehicle: { registration: 'T-1' }, packageKey: 'basic', listPrice: 1, quotedPrice: 1, ...extra });
  await job({ status: 'unassigned' }); await job({ status: 'completed' }); await job({ status: 'cancelled' });

  for (const bad of [-1, 1.5, 'abc', 5000]) await assert.rejects(setTarget(rep._id, { target: bad }, { id: admin._id.toString() }), (e) => e.message.includes('whole number'));
  await assert.rejects(setTarget(admin._id, { target: 3 }, { id: admin._id.toString() }), (e) => e.message.includes('No salesperson'));
  const updated = await setTarget(rep._id, { target: 3 }, { id: admin._id.toString(), name: 'Target Admin' });
  assert.equal(updated.monthlyTarget, 3);
  assert.equal(await Activity.countDocuments({ type: 'target.updated' }), 1);

  assert.deepEqual(await getMonthlyProgress(rep._id), { monthly: 3, done: 2, remaining: 1, met: false });
  assert.deepEqual((await getSalesBoard({ ownerId: rep._id })).target, { monthly: 3, done: 2, remaining: 1, met: false });
  assert.equal((await getSalesBoard()).target, undefined, 'the company board has no personal target');
});

test('duplicate customers: the same phone in any format is caught, with a way to confirm a different customer', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer, phoneKeysOf } = await import('../src/models/Customer.js');
  const { createCustomer, checkDuplicateCustomers } = await import('../src/modules/customers/customers.service.js');

  assert.deepEqual(phoneKeysOf('0300 1112233 / +92 315-4445566'), ['3001112233', '3154445566']);
  assert.deepEqual(phoneKeysOf('abc'), []);

  const ali = await User.create({ name: 'Dup Ali', email: 'dup-ali@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const sara = await User.create({ name: 'Dup Sara', email: 'dup-sara@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const viewer = (user) => ({ id: user._id.toString(), role: 'salesperson' });

  await createCustomer({ name: 'First', phone: '0300-5550000' }, ali._id, viewer(ali));
  await assert.rejects(createCustomer({ name: 'Second', phone: '+92 300 5550000' }, sara._id, viewer(sara)), (e) => e.status === 409 && e.details.duplicates[0].name === 'First');

  const seenBySara = await checkDuplicateCustomers('03005550000', viewer(sara));
  assert.equal(seenBySara[0].id, null, 'a salesperson cannot open someone else’s customer');
  assert.equal(seenBySara[0].owner, 'Dup Ali');
  const seenByAli = await checkDuplicateCustomers('03005550000', viewer(ali));
  assert.ok(seenByAli[0].id && seenByAli[0].mine);

  /* An older record saved before phone keys existed is still found. */
  await Customer.collection.insertOne({ name: 'Legacy', phone: '0321 7770000', owner: ali._id, category: 'Fleet', createdAt: new Date(), updatedAt: new Date() });
  assert.equal((await checkDuplicateCustomers('03217770000', viewer(ali))).length, 1);

  const forced = await createCustomer({ name: 'Second', phone: '03005550000', confirmDuplicate: true }, sara._id, viewer(sara));
  assert.equal(forced.name, 'Second');
  assert.equal((await checkDuplicateCustomers('03005550000', viewer(ali))).length, 2);
});

test('admin audit trail: technician changes and package price changes say who changed what', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { default: Technician } = await import('../src/models/Technician.js');
  const { default: Activity } = await import('../src/models/Activity.js');
  const { updateJob } = await import('../src/modules/operations/operations.service.js');
  const { updatePackage } = await import('../src/modules/pricing/pricing.service.js');

  const admin = await User.create({ name: 'Trail Admin', email: 'trail-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const actor = { id: admin._id.toString(), name: 'Trail Admin', role: 'admin' };
  const customer = await Customer.create({ name: 'Trail Customer', phone: '03006660000', owner: admin._id });
  const zahoor = await Technician.create({ name: 'Zahoor', station: 'Lahore' });
  const bilal = await Technician.create({ name: 'Bilal', station: 'Lahore' });
  const job = await Job.create({ createdBy: admin._id, customer: customer._id, customerName: customer.name, requestType: 'new_installation', vehicle: { registration: 'TR-1', station: 'Lahore' }, status: 'unassigned' });

  await updateJob(job._id, { technicianId: zahoor._id.toString() }, actor);
  await updateJob(job._id, { technicianId: bilal._id.toString() }, actor);
  await updateJob(job._id, { notes: 'no technician change' }, actor);
  const moves = await Activity.find({ type: 'job.reassigned' }).sort({ createdAt: 1 });
  assert.equal(moves.length, 2, 'only real changes are recorded');
  assert.match(moves[0].description, /nobody → Zahoor/);
  assert.match(moves[1].description, /Zahoor → Bilal/);

  await updatePackage('basic', { price: 10000 }, actor);
  await updatePackage('basic', { price: 12000 }, actor);
  const prices = await Activity.find({ type: 'pricing.updated' }).sort({ createdAt: 1 });
  assert.match(prices[1].description, /from PKR 10,000 to PKR 12,000/);
});
