import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let Device; let Sim; let Technician; let bind; let tech;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ({ default: Device } = await import('../src/models/Device.js'));
  ({ default: Sim } = await import('../src/models/Sim.js'));
  ({ default: Technician } = await import('../src/models/Technician.js'));
  ({ bindPortalSim: bind } = await import('../src/modules/operations/simBinding.js'));
  tech = await Technician.create({ name: 'Imran', station: 'Rawalpindi', active: true });
});
after(async () => { if (hasDb) await closeTestDb(); });

test('a portal SIM is bound to an empty device and never marks it configured', { skip }, async () => {
  const device = await Device.create({ imei: '350000000005551', technician: tech._id, status: 'assigned' });
  const out = await bind(device, tech, '+92 300 5550001');
  assert.equal(out.outcome, 'bound');
  const saved = await Device.findOne({ imei: '350000000005551' });
  assert.equal(saved.configured, false);
  assert.equal((await Sim.findOne({ number: saved.simNumber })).deviceImei, '350000000005551');
});

test('an existing SIM is never overwritten; a different one is only reported', { skip }, async () => {
  const device = await Device.create({ imei: '350000000005552', technician: tech._id, status: 'assigned', simNumber: '03005550002' });
  assert.equal((await bind(device, tech, '03005550002')).outcome, 'same');
  assert.equal((await bind(device, tech, '03005550099')).outcome, 'mismatch');
  assert.equal((await Device.findOne({ imei: '350000000005552' })).simNumber, '03005550002');
});

test('a SIM paired with another device is a conflict, and no SIM means nothing happens', { skip }, async () => {
  await Device.create({ imei: '350000000005553', technician: tech._id, status: 'assigned', simNumber: '03005550003' });
  await Sim.create({ number: '03005550003', technician: tech._id, status: 'assigned', deviceImei: '350000000005553' });
  const other = await Device.create({ imei: '350000000005554', technician: tech._id, status: 'assigned' });
  assert.equal((await bind(other, tech, '03005550003')).outcome, 'conflict');
  assert.equal((await bind(other, tech, '')).outcome, 'none');
  assert.equal((await Device.findOne({ imei: '350000000005554' })).simNumber || '', '');
});

test('bind from the portal reads the SIM the portal holds for that IMEI and refuses when it has none', { skip }, async () => {
  const tracking = await import('../src/modules/tracking/tracking.service.js');
  const { bindSimFromPortal } = await import('../src/modules/operations/stockPortal.service.js');
  await Device.create({ imei: '350000000006661', technician: tech._id, status: 'assigned' });
  await Device.create({ imei: '350000000006662', technician: tech._id, status: 'assigned' });
  tracking.__setTechnicianStockCache([
    { imei: '350000000006661', simNumber: '03006660001', lastSeenAt: new Date().toISOString() },
    { imei: '350000000006662', simNumber: '', lastSeenAt: new Date().toISOString() },
  ]);
  const out = await bindSimFromPortal('350000000006661');
  assert.equal(out.outcome, 'bound');
  assert.equal((await Device.findOne({ imei: '350000000006661' })).configured, false);
  await assert.rejects(bindSimFromPortal('350000000006662'), (e) => /no SIM number/.test(e.message));
  await assert.rejects(bindSimFromPortal('350000000006669'), (e) => /does not list/.test(e.message));
});
