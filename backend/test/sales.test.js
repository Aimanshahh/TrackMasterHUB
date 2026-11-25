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

test('a sale can be put on hold and resumed, and held sales leave the active counts', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { getSalesBoard, suspendSale, resumeSale } = await import('../src/modules/sales/sales.service.js');

  const rep = await User.create({ name: 'Hold Rep', email: 'hold-rep@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const other = await User.create({ name: 'Other Rep', email: 'other-rep@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });
  const customer = await Customer.create({ name: 'Hold Customer', phone: '03003330000', owner: rep._id });
  const job = await Job.create({ createdBy: rep._id, customer: customer._id, customerName: customer.name, requestType: 'new_installation', vehicle: { registration: 'HOLD-1' }, packageKey: 'basic', listPrice: 10000, quotedPrice: 10000, status: 'unassigned' });
  const actor = { id: rep._id.toString(), role: 'salesperson' };

  await assert.rejects(suspendSale(job._id, actor, { reason: 'nope' }), (e) => e.message.includes('why'));
  await assert.rejects(suspendSale(job._id, { id: other._id.toString(), role: 'salesperson' }, { reason: 'other' }), (e) => e.message.includes('could not be found'));

  await suspendSale(job._id, actor, { reason: 'payment_pending', note: 'Pays Friday' });
  let board = await getSalesBoard({ ownerId: rep._id });
  assert.equal(board.totals.suspended, 1);
  assert.equal(board.totals.sales, 0, 'a held sale is not an active sale');
  assert.equal(board.suspended[0].suspension.reasonLabel, 'Waiting for payment');
  assert.equal(board.suspended[0].quotedPrice, undefined);
  await assert.rejects(suspendSale(job._id, actor, { reason: 'other' }), (e) => e.message.includes('already'));

  await resumeSale(job._id, actor);
  board = await getSalesBoard({ ownerId: rep._id });
  assert.equal(board.totals.suspended, 0);
  assert.equal(board.totals.sales, 1);
  assert.equal((await Job.findById(job._id)).status, 'unassigned', 'resuming keeps the job where it was');
});
