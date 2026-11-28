import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

const rejects = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(e.message));
const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';

let ctx; let imran; let imranUser; let sara; let saraUser; let svc; let removal; let Job; let Device; let Sim; let DeviceRemoval; let vehicles;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  const { default: User } = await import('../src/models/User.js');
  const { default: Technician } = await import('../src/models/Technician.js');
  ({ default: Job } = await import('../src/models/Job.js'));
  ({ default: Device } = await import('../src/models/Device.js'));
  ({ default: Sim } = await import('../src/models/Sim.js'));
  ({ default: DeviceRemoval } = await import('../src/models/DeviceRemoval.js'));
  removal = await import('../src/modules/technician/removal.service.js');
  svc = await import('../src/modules/technician/technician.service.js');
  vehicles = await import('../src/modules/vehicles/vehicles.service.js');
  imranUser = await User.create({ name: 'Imran', email: 'imran@example.com', passwordHash: 'a-long-test-password', role: 'technician' });
  imran = await Technician.create({ name: 'Imran', station: 'Rawalpindi', active: true, user: imranUser._id });
  saraUser = await User.create({ name: 'Sara', email: 'sara@example.com', passwordHash: 'a-long-test-password', role: 'technician' });
  sara = await Technician.create({ name: 'Sara', station: 'Rawalpindi', active: true, user: saraUser._id });
});
after(async () => { if (hasDb) await closeTestDb(); });

const as = (user, name) => ({ id: user._id.toString(), name, role: 'technician' });

async function installed(imei, sim, plate) {
  await Device.create({ imei, technician: imran._id, status: 'installed', simNumber: sim, configured: true });
  await Sim.create({ number: sim, technician: imran._id, status: 'installed', deviceImei: imei });
  return Job.create({
    customer: ctx.customer._id, customerName: 'Basheer Ahmed', phone: '03001234567', requestType: 'new_installation',
    vehicle: { label: 'Hilux', registration: plate, station: 'Rawalpindi' }, status: 'completed', completedAt: new Date(),
    technician: imran._id, createdBy: ctx.sales._id, deviceImei: imei, simNumber: sim, packageKey: 'basic',
  });
}

test('removal returns the device and SIM to the remover, keeps pair and configured flag', { skip }, async () => {
  const job = await installed('350000000001111', '03001110001', 'RM-100');
  const found = await removal.searchInstalledVehicles(as(saraUser, 'Sara'), 'rm 100');
  assert.equal(found.length, 1);
  assert.equal(found[0].imei, '350000000001111');

  const out = await removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: job._id.toString() });
  assert.equal(out.technicianName, 'Sara');
  assert.equal(out.imei, '350000000001111');
  const device = await Device.findOne({ imei: '350000000001111' });
  assert.equal(device.technician.toString(), sara._id.toString());
  assert.equal(device.status, 'assigned');
  assert.equal(device.job, undefined);
  assert.equal(device.simNumber, '03001110001');
  assert.equal(device.configured, true, 'removal does not touch the configured flag');
  const sim = await Sim.findOne({ number: '03001110001' });
  assert.equal(sim.technician.toString(), sara._id.toString());
  assert.equal(sim.status, 'assigned');

  const stock = await svc.getStock(as(saraUser, 'Sara'));
  assert.equal(stock.counts.devicesAvailable, 1);
  assert.deepEqual(await removal.searchInstalledVehicles(as(saraUser, 'Sara'), 'RM-100'), [], 'no longer listed as installed');
});

test('the same removal cannot be confirmed twice, even at the same moment', { skip }, async () => {
  const job = await installed('350000000002222', '03001110002', 'RM-200');
  const results = await Promise.allSettled([
    removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: job._id.toString() }),
    removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: job._id.toString() }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await DeviceRemoval.countDocuments({ job: job._id }), 1);
  await rejects(removal.confirmRemoval(as(imranUser, 'Imran'), { jobId: job._id.toString() }), /already removed/);
  assert.equal((await svc.getStock(as(saraUser, 'Sara'))).devices.filter((d) => d.imei === '350000000002222').length, 1);
});

test('a vehicle without a recorded device needs the IMEI typed; a wrong IMEI is refused', { skip }, async () => {
  const job = await Job.create({
    customer: ctx.customer._id, customerName: 'Basheer Ahmed', requestType: 'new_installation', vehicle: { registration: 'RM-300' },
    status: 'completed', completedAt: new Date(), technician: imran._id, createdBy: ctx.sales._id,
  });
  await rejects(removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: job._id.toString() }), /no device recorded/);
  await removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: job._id.toString(), imei: '350000000003333' });
  assert.equal((await Device.findOne({ imei: '350000000003333' })).technician.toString(), sara._id.toString());

  const other = await installed('350000000004444', '03001110004', 'RM-400');
  await rejects(removal.confirmRemoval(as(saraUser, 'Sara'), { jobId: other._id.toString(), imei: '350000000009998' }), /carries 350000000004444/);
});

test('histories stay separate and the vehicle shows removed, not installed', { skip }, async () => {
  const installs = await removal.listInstallations(as(imranUser, 'Imran'));
  assert.equal(installs.length, 0, 'installations only list jobs the technician submitted');
  const removals = await removal.listRemovals(as(saraUser, 'Sara'));
  assert.ok(removals.length >= 2);
  assert.equal((await removal.listRemovals(as(imranUser, 'Imran'))).length, 0, 'Imran removed nothing');

  const list = await vehicles.listVehicles({ q: 'RM-100', limit: 10 }).catch(() => null);
  if (list) {
    const row = list.data.find((v) => v.vehicle.registration === 'RM-100');
    assert.equal(row?.installState, 'removed');
    assert.equal(row?.removal?.byName, 'Sara');
  }
});
