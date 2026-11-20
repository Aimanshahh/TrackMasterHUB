import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { normalizeRow } from '../src/modules/imports/normalize.js';
import { categoryForCount } from '../src/utils/customerCategory.js';
import { coreVrn, splitVrn } from '../src/utils/vrn.js';
import { INACTIVE_AFTER_DAYS, __setTrackingCache, isVehicleInactive, statusFor } from '../src/modules/tracking/tracking.service.js';
import { closeTestDb, connectTestDb, hasDb } from './helpers.js';

const skip = !hasDb;
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-19T10:00:00Z');
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const past = '2026-01-01T00:00:00Z';
const future = '2027-06-01T00:00:00Z';

/* ---------- pure rules ---------- */

test('(LOC) and (IMB) are stripped to the real registration', () => {
  assert.deepEqual(splitVrn('ABC-111(LOC)'), { vrn: 'ABC-111', role: 'locator' });
  assert.deepEqual(splitVrn('ABC-111 (IMB)'), { vrn: 'ABC-111', role: 'immobilizer' });
  assert.deepEqual(splitVrn('abc-111(loc)'), { vrn: 'abc-111', role: 'locator' });
  assert.equal(coreVrn('ABC-111'), 'ABC-111');
  assert.equal(splitVrn('LOC-123').role, null); // letters that are part of a plate are not a suffix
  assert.equal(splitVrn('IMB 555').vrn, 'IMB 555');
});

test('the row normaliser keeps the core plate, the device role, the AMC date and the raw package name', () => {
  const headers = ['VRN', 'Package', 'AMC Expiry', 'Inspection', 'Network'];
  const mapping = { registration: 'VRN', packageKey: 'Package', amcExpiry: 'AMC Expiry', inspectionStatus: 'Inspection', network: 'Network' };
  const { values, warnings } = normalizeRow(['ABC-111(IMB)', 'Gold Plus', '25-12-2026', 'Redo', 'Jazz'], headers, mapping);
  assert.equal(values.registration, 'ABC-111');
  assert.equal(values.deviceRole, 'immobilizer');
  assert.equal(values.plateKey, 'ABC111');
  assert.equal(values.packageRaw, 'Gold Plus');
  assert.equal(values.packageKey, '');
  assert.equal(values.amcExpiryDate.toISOString().slice(0, 10), '2026-12-25');
  assert.equal(values.inspectionStatus, 'Redo');
  assert.ok(warnings.some((w) => /Gold Plus/.test(w)));
});

test('Fleet from three vehicles, Individual for one or two', () => {
  assert.equal(categoryForCount(0), null);
  assert.equal(categoryForCount(1), 'Individual');
  assert.equal(categoryForCount(2), 'Individual');
  assert.equal(categoryForCount(3), 'Fleet');
  assert.equal(categoryForCount(40), 'Fleet');
});

test('15-day rule: inactive only when silent for more than 15 days AND the AMC has expired', () => {
  assert.equal(INACTIVE_AFTER_DAYS, 15);
  assert.equal(isVehicleInactive({ lastSeenAt: ago(20), amcExpiryDate: past }, NOW), true);
  assert.equal(isVehicleInactive({ lastSeenAt: ago(20), amcExpiryDate: future }, NOW), false, 'silent but AMC valid');
  assert.equal(isVehicleInactive({ lastSeenAt: ago(20), amcExpiryDate: null }, NOW), false, 'silent, AMC unknown');
  assert.equal(isVehicleInactive({ lastSeenAt: ago(3), amcExpiryDate: past }, NOW), false, 'AMC expired but still reporting');
  assert.equal(isVehicleInactive({ lastSeenAt: ago(15), amcExpiryDate: past }, NOW), false, 'exactly 15 days is not more than 15');
  assert.equal(isVehicleInactive({ lastSeenAt: null, amcExpiryDate: past }, NOW), true, 'never reported and AMC expired');
});

test('statusFor applies the rule and prefers the AMC date saved in our database', () => {
  __setTrackingCache([
    { imei: '111111111111111', gpsState: 'offline', lastSeenAt: ago(30), amcExpiryDate: future, name: 'A', portalSource: 'Main Server (Active)' },
    { imei: '222222222222222', gpsState: 'offline', lastSeenAt: ago(30), amcExpiryDate: null, name: 'B', portalSource: 'Main Server (Active)' },
  ]);
  // The portal says the AMC is valid, our imported date says expired: ours wins.
  assert.equal(statusFor('X', '111111111111111', NOW, { amcExpiryDate: past }).status, 'inactive');
  // Without our date the portal's is used.
  assert.equal(statusFor('X', '111111111111111', NOW).status, 'active');
  // Neither has a date: not inactive.
  assert.equal(statusFor('X', '222222222222222', NOW).status, 'active');
  assert.equal(statusFor('X', '999999999999999', NOW).status, 'not_tracked');
});

/* ---------- database ---------- */

let ctx;
const FILE = [
  'Customer Name,Phone,VRN,Make/Model,IMEI,SIM Number,Network,Package Name,Package Price,AMC Expiry Date,Inspection Status,Notes',
  'Fleet Co,03001110000,AAA-100(LOC),Toyota Hilux,356000000000001,03001000001,Jazz,Premium,45000,2027-02-01,Installed,first',
  'Fleet Co,03001110000,AAA-100(IMB),Toyota Hilux,356000000000002,03001000002,Jazz,Premium,45000,2027-02-01,Installed,second device',
  'Fleet Co,03001110000,AAA-200,Honda City,356000000000003,03001000003,Zong,Basic,12000,2025-01-01,Redo,',
  'Fleet Co,03001110000,AAA-300,Suzuki Alto,356000000000004,03001000004,Ufone,Basic,12000,,Removal,',
  'Solo Sam,03002220000,SOL-1,Kia Sportage,356000000000005,03001000005,Jazz,Standard,20000,2027-03-03,Installed,',
].join('\n');

before(async () => { if (!hasDb) return; await connectTestDb(); ctx = {}; });
after(async () => { if (hasDb) await closeTestDb(); });

test('legacy sheet: dual devices group into one vehicle, AMC date is saved, history is dateless, categories are set', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { default: TimelineEvent } = await import('../src/models/TimelineEvent.js');
  const svc = await import('../src/modules/imports/imports.service.js');
  const history = await import('../src/modules/customers/history.service.js');

  const admin = await User.create({ name: 'Legacy Admin', email: 'legacy-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const actor = { id: admin._id.toString(), role: 'admin' };

  const up = await svc.createBatchFromUpload(Buffer.from(FILE), 'legacy.csv', actor);
  for (const key of ['network', 'amcExpiry', 'inspectionStatus', 'registration', 'packageKey', 'packagePrice']) assert.ok(up.batch.mapping[key], `${key} is matched`);
  const prev = await svc.previewBatch(up.batch.id, { mapping: up.batch.mapping });
  assert.equal(prev.batch.summary.errors, 0);
  assert.equal(prev.batch.summary.newVehicles, 4);
  assert.equal(prev.batch.summary.addedDevices, 1);
  assert.equal(prev.batch.summary.duplicates, 0, 'the (IMB) row is a second device, not a duplicate');
  await svc.confirmBatch(up.batch.id, { previewHash: prev.batch.previewHash }, actor);

  // One vehicle record with two devices, each with its own IMEI and SIM.
  const fleet = await Customer.findOne({ name: 'Fleet Co' });
  const jobs = await Job.find({ customer: fleet._id }).sort({ 'vehicle.registration': 1 });
  assert.equal(jobs.length, 3);
  const dual = jobs[0];
  assert.equal(dual.vehicle.registration, 'AAA-100');
  assert.equal(dual.devices.length, 2);
  assert.deepEqual(dual.devices.map((d) => [d.role, d.imei, d.simNumber]), [
    ['locator', '356000000000001', '03001000001'], ['immobilizer', '356000000000002', '03001000002'],
  ]);
  assert.equal(dual.deviceImei, '356000000000001');
  assert.equal(dual.network, 'Jazz');

  // The AMC date from the sheet is stored on the vehicle.
  assert.equal(dual.amcExpiryDate.toISOString().slice(0, 10), '2027-02-01');
  assert.equal(jobs[2].amcExpiryDate, null);

  // 3 vehicles is a Fleet; 1 vehicle is an Individual.
  assert.equal((await Customer.findById(fleet._id)).category, 'Fleet');
  assert.equal((await Customer.findOne({ name: 'Solo Sam' })).category, 'Individual');

  // Past actions have no date and are marked historical.
  const events = await TimelineEvent.find({ customer: fleet._id });
  assert.ok(events.length >= 4);
  assert.ok(events.every((e) => e.isHistoricalData === true && e.date === null));
  assert.ok(events.some((e) => e.kind === 'inspection' && e.action === 'Redo'));
  assert.ok(events.some((e) => e.kind === 'package' && e.action === 'Premium'));

  // The customer history lists them at the bottom, worded for the screen; no price for roles that cannot see money.
  const asAdmin = await history.getCustomerHistory(fleet._id.toString(), actor);
  assert.ok(asAdmin.legacyTimeline.some((e) => e.title === 'Legacy Record: Inspection: Redo (Date Unknown)'));
  assert.ok(asAdmin.legacyTimeline.every((e) => e.at === null && e.isHistoricalData));
  assert.ok(asAdmin.legacyTimeline.some((e) => /Price/.test(e.detail)));
  assert.ok(!asAdmin.timeline.some((e) => e.at === null), 'dated timeline is unchanged');

  const asOps = await history.getCustomerHistory(fleet._id.toString(), { id: admin._id.toString(), role: 'operations' });
  assert.ok(asOps.legacyTimeline.every((e) => !/Price/.test(e.detail)));

  // Importing the same vehicles again changes nothing.
  const again = await svc.createBatchFromUpload(Buffer.from(FILE), 'legacy.csv', actor);
  const prev2 = await svc.previewBatch(again.batch.id, { mapping: again.batch.mapping });
  assert.equal(prev2.batch.summary.newVehicles, 0);
  assert.equal(prev2.batch.summary.addedDevices, 0);
  ctx.fleetId = fleet._id;
  ctx.adminId = admin._id;
});

test('a category chosen by a person (Dealer, Corporate) is never overridden', { skip }, async () => {
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { refreshCustomerCategory } = await import('../src/utils/customerCategory.js');

  const dealer = await Customer.create({ name: 'Big Dealer', phone: '03003330000', category: 'Dealer' });
  for (let i = 1; i <= 4; i += 1) {
    await Job.create({ createdBy: ctx.adminId, customer: dealer._id, customerName: dealer.name, requestType: 'new_installation', status: 'completed', vehicle: { registration: `DLR-${i}` } });
  }
  assert.equal((await Customer.findById(dealer._id)).category, 'Dealer');
  assert.equal(await refreshCustomerCategory(dealer._id), null);

  // A manual Individual with 3 vehicles added one by one becomes a Fleet automatically.
  const person = await Customer.create({ name: 'Growing Gary', phone: '03004440000', category: 'Individual' });
  for (let i = 1; i <= 3; i += 1) {
    await Job.create({ createdBy: ctx.adminId, customer: person._id, customerName: person.name, requestType: 'new_installation', status: 'unassigned', vehicle: { registration: `GRW-${i}` } });
    const expected = i >= 3 ? 'Fleet' : 'Individual';
    assert.equal((await Customer.findById(person._id)).category, expected);
  }
  // A two-device vehicle counts once.
  const pair = await Customer.create({ name: 'Pair Pat', phone: '03005550000' });
  await Job.create({ createdBy: ctx.adminId, customer: pair._id, requestType: 'new_installation', status: 'completed', vehicle: { registration: 'PAR-1(LOC)' } });
  await Job.create({ createdBy: ctx.adminId, customer: pair._id, requestType: 'new_installation', status: 'completed', vehicle: { registration: 'PAR-1(IMB)' } });
  assert.equal((await Customer.findById(pair._id)).category, 'Individual');
});

test('vehicle list shows (LOC)/(IMB) jobs saved the old way as one vehicle with two devices', { skip }, async () => {
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const vehicles = await import('../src/modules/vehicles/vehicles.service.js');

  const c = await Customer.create({ name: 'Old Import Ltd', phone: '03006660000' });
  await Job.create({ createdBy: ctx.adminId, customer: c._id, customerName: c.name, requestType: 'new_installation', status: 'completed', deviceImei: '356111111111111', simNumber: '0300111', vehicle: { registration: 'OLD-9(LOC)' } });
  await Job.create({ createdBy: ctx.adminId, customer: c._id, customerName: c.name, requestType: 'new_installation', status: 'completed', deviceImei: '356222222222222', simNumber: '0300222', vehicle: { registration: 'OLD-9(IMB)' } });

  const list = await vehicles.listVehicles({ q: 'OLD-9', limit: 50 });
  assert.equal(list.data.length, 1);
  const [v] = list.data;
  assert.equal(v.vehicle.registration, 'OLD-9');
  assert.equal(v.deviceCount, 2);
  assert.deepEqual(v.devices.map((d) => d.imei).sort(), ['356111111111111', '356222222222222']);
});
