import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
const rejects = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(e.message));

let ctx; let tech; let techUser; let opsActor; let svc; let review; let tracking; let Job; let Customer;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  const { default: User } = await import('../src/models/User.js');
  const { default: Technician } = await import('../src/models/Technician.js');
  const { default: Package } = await import('../src/models/Package.js');
  ({ default: Job } = await import('../src/models/Job.js'));
  ({ default: Customer } = await import('../src/models/Customer.js'));
  svc = await import('../src/modules/technician/technician.service.js');
  review = await import('../src/modules/operations/review.service.js');
  tracking = await import('../src/modules/tracking/tracking.service.js');
  for (const key of ['basic', 'standard']) await Package.create({ key, price: 15000 });
  techUser = await User.create({ name: 'Imran', email: 'imran@example.com', passwordHash: 'a-long-test-password', role: 'technician' });
  tech = await Technician.create({ name: 'Imran', station: 'Rawalpindi', active: true, user: techUser._id, rates: { normal: 1000 } });
  opsActor = { id: ctx.admin._id.toString(), name: 'Ops Person', role: 'operations' };
});
after(async () => { if (hasDb) await closeTestDb(); });

const actor = () => ({ id: techUser._id.toString(), name: 'Imran', role: 'technician' });
const reading = (over = {}) => ({
  imei: '350000000009999', lastSeenAt: new Date().toISOString(), ignitionOn: true, batteryConnected: true,
  latitude: 33.6, longitude: 73.04, objectStatus: 'Moving', ...over,
});

async function sale(plate, packageKey) {
  const { default: Device } = await import('../src/models/Device.js');
  const { default: Sim } = await import('../src/models/Sim.js');
  const imei = '350000000009999';
  await Device.deleteMany({}); await Sim.deleteMany({});
  await Device.create({ imei, model: 'FMB920', station: 'Rawalpindi', status: 'assigned', technician: tech._id });
  await Sim.create({ number: '03005559999', network: 'Jazz', station: 'Rawalpindi', status: 'assigned', technician: tech._id });
  const job = await Job.create({
    customer: ctx.customer._id, customerName: 'Basheer Ahmed', phone: '03001234567', requestType: 'new_installation',
    vehicle: { label: 'Hilux', registration: plate, station: 'Rawalpindi' }, status: 'assigned', packageKey,
    technician: tech._id, createdBy: ctx.sales._id, quotedPrice: 20000,
  });
  await svc.selectStock(actor(), job._id.toString(), { imei, simNumber: '03005559999' });
  return job._id.toString();
}

test('portal tests: ignition and battery need both states, location needs a position and where it was fitted', { skip }, async () => {
  const id = await sale('VRN 567', 'basic');
  tracking.__setTechnicianStockCache([reading()]);

  let out = await svc.runPortalCheck(actor(), id);
  assert.equal(out.job.testing.ignition.status, 'pending', 'ON alone is not enough');
  assert.equal(out.job.testing.ignition.seenOn, true);
  assert.equal(out.job.testing.battery.seenConnected, true);

  tracking.__setTechnicianStockCache([reading({ ignitionOn: false, batteryConnected: false })]);
  out = await svc.runPortalCheck(actor(), id);
  assert.equal(out.job.testing.ignition.status, 'verified');
  assert.equal(out.job.testing.battery.status, 'verified');
  assert.equal(out.job.testing.location.status, 'pending', 'needs the physical location too');

  await rejects(svc.saveTest(actor(), id, { battery: { status: 'verified' } }), /read from the tracking portal/);

  out = await svc.saveTest(actor(), id, { location: { physicalLocation: 'Under the dashboard, Satellite Town' } });
  assert.equal(out.job.testing.location.status, 'verified');
  assert.equal(out.job.testing.location.latitude, 33.6);

  /* Basic has no engine kill: submit works without it, and a request is refused. */
  assert.equal(out.job.testing.engineKillApplicable, false);
  await rejects(svc.requestEngineKillTest(actor(), id, {}), /does not include an engine kill/);
  await svc.submitForReview(actor(), id);

  const approved = await review.reviewInstallation(id, { decision: 'approve' }, opsActor);
  assert.equal(approved.job.status, 'completed');
  const customer = await Customer.findById(ctx.customer._id);
  assert.equal(customer.appLogin, 'vrn-567@trackmaster.pk');
});

test('portal tests: stale or missing portal readings never count', { skip }, async () => {
  const id = await sale('ABC-123', 'basic');
  tracking.__setTechnicianStockCache([]);
  let out = await svc.runPortalCheck(actor(), id);
  assert.match(out.job.testing.portalCheck.message, /does not list this IMEI|not been read/);

  tracking.__setTechnicianStockCache([reading({ lastSeenAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() })]);
  out = await svc.runPortalCheck(actor(), id);
  assert.equal(out.job.testing.portalCheck.stale, true);
  assert.equal(out.job.testing.ignition.seenOn, false);
});

test('engine kill: standard needs a request or a "cannot fit" note; operations confirms before approval', { skip }, async () => {
  const id = await sale('KIL-100', 'standard');
  tracking.__setTechnicianStockCache([reading({ ignitionOn: true, batteryConnected: true })]);
  await svc.runPortalCheck(actor(), id);
  tracking.__setTechnicianStockCache([reading({ ignitionOn: false, batteryConnected: false })]);
  await svc.runPortalCheck(actor(), id);
  await svc.saveTest(actor(), id, { location: { physicalLocation: 'Behind glovebox' } });

  await rejects(svc.submitForReview(actor(), id), /engine kill/);
  await rejects(svc.markEngineKillUnsupported(actor(), id, {}), /note/);

  let out = await svc.requestEngineKillTest(actor(), id, { note: 'Called Operations' });
  assert.equal(out.job.testing.engineKillTest.status, 'requested');
  await svc.submitForReview(actor(), id);
  await rejects(review.reviewInstallation(id, { decision: 'approve', restored: false }, opsActor), /restored/);
  const done = await review.reviewInstallation(id, { decision: 'approve' }, opsActor);
  assert.equal(done.job.testing.engineKill, 'verified');
});

test('engine kill: a vehicle that cannot take one is approved without the kill test', { skip }, async () => {
  const id = await sale('NOK-200', 'standard');
  tracking.__setTechnicianStockCache([reading({ ignitionOn: true })]);
  await svc.runPortalCheck(actor(), id);
  tracking.__setTechnicianStockCache([reading({ ignitionOn: false, batteryConnected: false })]);
  await svc.runPortalCheck(actor(), id);
  await svc.saveTest(actor(), id, { location: { physicalLocation: 'Dash' } });
  const out = await svc.markEngineKillUnsupported(actor(), id, { note: 'Diesel with no relay point' });
  assert.equal(out.job.testing.engineKillTest.status, 'not_supported');
  await svc.submitForReview(actor(), id);
  const done = await review.reviewInstallation(id, { decision: 'approve' }, opsActor);
  assert.equal(done.job.status, 'completed');
});

test('admin sales board leaves out legacy imported vehicles', { skip }, async () => {
  const { getSalesBoard } = await import('../src/modules/sales/sales.service.js');
  await Job.create({
    customer: ctx.customer._id, customerName: 'Old', requestType: 'new_installation', vehicle: { registration: 'OLD-1' },
    status: 'completed', createdBy: ctx.admin._id, legacy: { imported: true },
  });
  const board = await getSalesBoard();
  assert.ok(!board.recent.some((row) => /OLD-1/.test(JSON.stringify(row))));
});
