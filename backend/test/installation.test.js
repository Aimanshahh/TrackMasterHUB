import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';
import { CHECKLIST_KEYS, completionMissing } from '../src/utils/installation.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
const rejects = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(e.message));
const allTicked = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]));

let ctx;
let ops;
let tech;
let opsActor;
let n = 0;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  ops = await import('../src/modules/operations/operations.service.js');
  const { default: Technician } = await import('../src/models/Technician.js');
  const { default: Package } = await import('../src/models/Package.js');
  await Package.create({ key: 'basic', price: 15000 });
  tech = await Technician.create({ name: 'Imran', station: 'Rawalpindi', active: true });
  opsActor = { id: ctx.admin._id.toString(), name: 'Ops Person', role: 'operations' };
});

after(async () => {
  if (hasDb) await closeTestDb();
});

async function stock() {
  const { default: Device } = await import('../src/models/Device.js');
  const { default: Sim } = await import('../src/models/Sim.js');
  n += 1;
  const imei = `35000000000${String(n).padStart(4, '0')}`;
  const number = `0300555${String(n).padStart(4, '0')}`;
  await Device.create({ imei, model: 'FMB920', station: 'Rawalpindi', status: 'in_stock' });
  await Sim.create({ number, network: 'Jazz', station: 'Rawalpindi', status: 'in_stock' });
  return { imei, number };
}

async function newSale(plate) {
  return ops.createJob({
    customerId: ctx.customer._id.toString(),
    vehicleLabel: 'Hilux',
    vehicleRegistration: plate,
    station: 'Rawalpindi',
    packageKey: 'basic',
    quotedPrice: 20000,
  }, { id: ctx.sales._id.toString(), role: 'salesperson' });
}

const details = {
  placement: 'Under dashboard',
  address: 'Satellite Town, Rawalpindi',
  deviceModel: 'FMB920',
  engineNo: 'ENG-1',
  chassisNo: 'CH-1',
  batteryTemperatureC: 31.5,
  testResult: 'Reporting every 30s',
  technicianRemarks: 'Clean install',
  checklist: allTicked,
};

test('completion rules list everything missing and treat engine kill as its own decision', () => {
  const empty = completionMissing({ vehicle: {}, installation: {} }).map((m) => m.field);
  for (const f of ['technician', 'registration', 'deviceImei', 'simNumber', 'placement', 'address', 'engineKill', 'checklist.gpsSignal']) {
    assert.ok(empty.includes(f), f);
  }
  const base = { technician: 'x', vehicle: { registration: 'A-1' }, deviceImei: '1', simNumber: '2', installation: { placement: 'p', address: 'a', checklist: { ...allTicked, immobilizationTested: false }, engineKill: { status: 'not_implemented', reason: 'Not supported' } } };
  assert.deepEqual(completionMissing(base), []);
  assert.deepEqual(completionMissing({ ...base, installation: { ...base.installation, engineKill: { status: 'not_implemented', reason: ' ' } } }).map((m) => m.field), ['engineKill.reason']);
});

test('a sale reaches Operations unassigned and Operations can assign a technician', { skip }, async () => {
  const job = await newSale('LEB-100');
  assert.equal(job.status, 'unassigned');
  const listed = await ops.listJobs({});
  assert.ok(listed.data.some((j) => j.id === job.id));
  const assigned = await ops.updateJob(job.id, { technicianId: tech._id.toString(), status: 'assigned' }, opsActor);
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.technician.name, 'Imran');
});

test('completion is refused until the essentials, checklist and engine-kill decision are recorded', { skip }, async () => {
  const job = await newSale('LEB-200');
  const s = await stock();
  await ops.updateJob(job.id, { technicianId: tech._id.toString(), deviceImei: s.imei, simNumber: s.number, status: 'in_progress' }, opsActor);

  await rejects(ops.updateJob(job.id, { status: 'completed' }, opsActor), /not ready to complete/);

  // Details alone are not enough: no checklist, no engine kill decision.
  await ops.updateJob(job.id, { placement: 'Dashboard', address: 'Rawalpindi' }, opsActor);
  await rejects(ops.updateJob(job.id, { status: 'completed' }, opsActor), /GPS signal verified/);

  await ops.updateJob(job.id, { checklist: { ...allTicked, immobilizationTested: false } }, opsActor);
  await rejects(ops.updateJob(job.id, { status: 'completed' }, opsActor), /engine kill status/);

  // Implemented needs the immobilization test ticked.
  await ops.updateJob(job.id, { engineKill: { status: 'implemented' } }, opsActor);
  await rejects(ops.updateJob(job.id, { status: 'completed' }, opsActor), /immobilization tested/);

  // "Not implemented" needs a reason.
  await rejects(ops.updateJob(job.id, { engineKill: { status: 'not_implemented', reason: '  ' } }, opsActor), /reason/);
});

test('full flow: details saved, checklist in history, completed with engine kill Implemented', { skip }, async () => {
  const job = await newSale('LEB-300');
  const s = await stock();
  const done = await ops.updateJob(job.id, {
    technicianId: tech._id.toString(), deviceImei: s.imei, simNumber: s.number, ...details,
    engineKill: { status: 'implemented', reason: 'Relay fitted' }, status: 'completed',
  }, opsActor);

  assert.equal(done.status, 'completed');
  assert.ok(done.completedAt);
  assert.equal(done.installation.placement, 'Under dashboard');
  assert.equal(done.installation.batteryTemperatureC, 31.5);
  assert.equal(done.installation.checklist.gpsSignal, true);
  assert.equal(done.engineKill.status, 'implemented');
  assert.equal(done.engineKill.updatedBy, 'Ops Person');
  assert.ok(done.history.some((h) => h.kind === 'checklist' && h.by === 'Ops Person'));
  assert.ok(done.history.some((h) => h.kind === 'engine_kill'));
  assert.equal(done.completion, null);
});

test('GPS installation completes when engine kill is Not implemented, with the reason kept', { skip }, async () => {
  const job = await newSale('LEB-400');
  const s = await stock();
  const done = await ops.updateJob(job.id, {
    technicianId: tech._id.toString(), deviceImei: s.imei, simNumber: s.number, ...details,
    checklist: { ...allTicked, immobilizationTested: false },
    engineKill: { status: 'not_implemented', reason: 'Vehicle has no relay point' }, status: 'completed',
  }, opsActor);
  assert.equal(done.status, 'completed');
  assert.equal(done.engineKill.status, 'not_implemented');
  assert.equal(done.engineKill.reason, 'Vehicle has no relay point');
});

test('engine kill can be changed later and every change is preserved', { skip }, async () => {
  const [{ id }] = (await ops.listJobs({ q: 'LEB-400' })).data;
  const a = await ops.updateEngineKill(id, { status: 'implemented', reason: 'Relay added at service' }, opsActor);
  assert.equal(a.engineKill.status, 'implemented');
  const b = await ops.updateEngineKill(id, { status: 'not_implemented', reason: 'Relay removed by owner' }, opsActor);
  assert.equal(b.engineKillHistory.length, 3);
  assert.deepEqual(b.engineKillHistory.map((e) => e.to), ['not_implemented', 'implemented', 'not_implemented']);
  assert.equal(b.engineKillHistory[1].from, 'not_implemented');
  assert.equal(b.engineKillHistory[0].reason, 'Vehicle has no relay point');
  assert.equal(b.status, 'completed');
  await rejects(ops.updateEngineKill(id, { status: 'not_implemented' }, opsActor), /reason/);
  await rejects(ops.updateEngineKill(id, { status: 'bogus' }, opsActor), /Choose Implemented/);
});

test('a completed installation cannot be edited back to an incomplete state', { skip }, async () => {
  const [{ id }] = (await ops.listJobs({ q: 'LEB-300' })).data;
  await rejects(ops.updateJob(id, { checklist: { gpsSignal: false } }, opsActor), /not ready to complete/);
});

test('vehicle profile joins installs, engine kill history and customer by plate', { skip }, async () => {
  const { getVehicleProfile } = await import('../src/modules/vehicles/vehicles.service.js');
  const [{ id }] = (await ops.listJobs({ q: 'LEB-400' })).data;
  const { data } = await getVehicleProfile(id);
  assert.equal(data.vehicle.registration, 'LEB-400');
  assert.equal(data.customer.name, 'Basheer Ahmed');
  assert.equal(data.engineKill.status, 'not_implemented');
  assert.equal(data.engineKillHistory.length, 3);
  assert.equal(data.installations.length, 1);
  assert.equal(data.device.placement, 'Under dashboard');
  await rejects(getVehicleProfile('000000000000000000000000'), /No vehicle/);
});

test('routes: only admin and operations can change engine kill; salesperson and manager cannot', () => {
  return import('../src/modules/operations/operations.routes.js').then(({ operationsRouter }) => {
    const layer = operationsRouter.stack.find((l) => l.route?.path === '/jobs/:id/engine-kill');
    assert.ok(layer, 'route exists');
    assert.ok(layer.route.methods.patch);
    const guard = layer.route.stack[0].handle;
    const run = (role) => new Promise((resolve) => guard({ user: { role } }, {}, (err) => resolve(err ?? null)));
    return Promise.all(['admin', 'operations'].map(run)).then(async (ok) => {
      assert.deepEqual(ok, [null, null]);
      for (const role of ['manager', 'salesperson']) assert.ok(await run(role), `${role} must be blocked`);
    });
  });
});
