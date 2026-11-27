import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';

import { matchTechnician, normalizeName } from '../src/utils/technicianMatch.js';
import { closeTestDb, connectTestDb, hasDb } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';

test('names are compared without the word Technician, case or spacing', () => {
  assert.equal(normalizeName('Zahoor Technician'), 'zahoor');
  assert.equal(normalizeName('Technician Yusuf'), 'yusuf');
  assert.equal(normalizeName('  ZAHOOR  '), 'zahoor');
  const techs = [{ name: 'Zahoor' }, { name: 'Yusuf Khan' }, { name: 'Akbar', aliases: ['Akbar Ali'] }, { name: 'Nadir Shah' }, { name: 'Nadir Hussain' }];
  assert.equal(matchTechnician('Zahoor Technician', techs).how, 'exact');
  assert.equal(matchTechnician('Technician Yusuf', techs).how, 'suggested');
  assert.equal(matchTechnician('Akbar Ali', techs).how, 'alias');
  assert.equal(matchTechnician('Nadir', techs).how, null, 'two Nadirs is ambiguous, so nothing is guessed');
  assert.equal(matchTechnician('Waqas Technician', techs).how, null);
});

let ctx;
before(async () => { if (!hasDb) return; await connectTestDb(); ctx = {}; });
after(async () => { if (hasDb) { ctx?.server?.close(); await closeTestDb(); } });

test('the Shezz import matches technicians, assigns devices, is repeatable and respects fitted devices', { skip }, async () => {
  const { env } = await import('../src/config/env.js');
  const { default: Technician } = await import('../src/models/Technician.js');
  const { default: Device } = await import('../src/models/Device.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { default: User } = await import('../src/models/User.js');
  const { previewShezzSync, applyShezzSync } = await import('../src/modules/operations/shezz.service.js');

  const rows = [
    { imei: '860000000000001', recipient: { id: 'r1', name: 'Zahoor Technician' }, productName: 'GT06', invoiceNumber: 'INV-1', boxCode: 'A-1' },
    { imei: '860000000000002', recipient: { id: 'r1', name: 'Zahoor Technician' } },
    { imei: '860000000000003', recipient: { id: 'r2', name: 'Technician Yusuf' } },
    { imei: '860000000000004', recipient: { id: 'r3', name: 'Waqas Technician' } },
    { imei: '123', recipient: { id: 'r1', name: 'Zahoor Technician' } },
    { imei: '860000000000002', recipient: { id: 'r2', name: 'Technician Yusuf' } },
  ];
  let seenKey = null;
  ctx.server = http.createServer((req, res) => {
    seenKey = req.headers['x-api-key'];
    if (seenKey !== 'k-test') { res.writeHead(401); return res.end('{}'); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: rows, hasMore: false }));
  });
  await new Promise((resolve) => ctx.server.listen(0, resolve));

  env.shezzApiUrl = '';
  env.shezzApiKey = '';
  await assert.rejects(previewShezzSync(), (e) => /not set up/.test(e.message));

  env.shezzApiUrl = `http://127.0.0.1:${ctx.server.address().port}`;
  env.shezzApiKey = 'wrong';
  await assert.rejects(previewShezzSync(), (e) => /refused the key/.test(e.message));
  env.shezzApiKey = 'k-test';

  const admin = await User.create({ name: 'Shezz Admin', email: 'shezz-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const zahoor = await Technician.create({ name: 'Zahoor', station: 'Karachi' });
  const yusuf = await Technician.create({ name: 'Yusuf Khan', station: 'Lahore' });
  const waqas = await Technician.create({ name: 'Waqas Ahmed', station: 'Karachi' });

  const preview = await previewShezzSync();
  const byName = Object.fromEntries(preview.groups.map((g) => [g.shezzName, g]));
  assert.equal(byName['Zahoor Technician'].match.how, 'exact');
  assert.equal(byName['Zahoor Technician'].newDevices, 1);
  assert.equal(byName['Zahoor Technician'].invalid, 1);
  assert.equal(byName['Technician Yusuf'].match.how, 'suggested');
  assert.equal(await Device.countDocuments(), 0, 'a preview changes nothing');

  // 002 was handed on again to Yusuf later, so it belongs to Yusuf.
  const first = await applyShezzSync({}, { id: admin._id });
  assert.equal(first.created, 1, 'only the exact match is imported by itself');
  assert.deepEqual(first.skippedNames.sort(), ['Technician Yusuf', 'Waqas Technician']);
  const d1 = await Device.findOne({ imei: '860000000000001' });
  assert.equal(d1.technician.toString(), zahoor._id.toString());
  assert.equal(d1.status, 'assigned');
  assert.equal(d1.station, 'Karachi');
  assert.match(d1.notes, /INV-1/);

  const second = await applyShezzSync({ mappings: { r2: yusuf._id.toString(), r3: waqas._id.toString() } }, { id: admin._id });
  assert.equal(second.created, 3);
  assert.equal(second.skippedNames.length, 0);
  const d2 = await Device.findOne({ imei: '860000000000002' });
  assert.equal(d2.technician.toString(), yusuf._id.toString());

  const remembered = await Technician.findById(yusuf._id);
  assert.ok(remembered.aliases.includes('Technician Yusuf'), 'a hand-picked spelling is remembered');
  const again = await previewShezzSync();
  assert.equal(again.groups.find((g) => g.shezzName === 'Technician Yusuf').match.how, 'alias');

  const third = await applyShezzSync({}, { id: admin._id });
  assert.equal(third.created, 0);
  assert.equal(third.reassigned, 0);
  assert.equal(third.unchanged, 4, 'running it again changes nothing');

  const { default: Customer } = await import('../src/models/Customer.js');
  const fitCustomer = await Customer.create({ name: 'Fit Customer' });
  const job = await Job.create({ createdBy: admin._id, customer: fitCustomer._id, customerName: 'Fit Customer', requestType: 'new_installation', status: 'completed', vehicle: { registration: 'LEA-1' } });
  await Device.updateOne({ imei: '860000000000001' }, { job: job._id, technician: waqas._id });
  const fitted = await applyShezzSync({}, { id: admin._id });
  assert.equal(fitted.fitted, 1);
  assert.equal((await Device.findOne({ imei: '860000000000001' })).technician.toString(), waqas._id.toString(), 'a fitted device is left alone');
});

test('the technician stock portal is a second source: groups are matched to technicians and devices import once', { skip: !hasDb ? 'set TEST_MONGO_URI to run database tests' : false }, async () => {
  const { default: Technician } = await import('../src/models/Technician.js');
  const { default: Device } = await import('../src/models/Device.js');
  const { previewHandovers, applyHandovers } = await import('../src/modules/operations/shezz.service.js');
  await Technician.create({ name: 'Portal Zahoor', station: 'Lahore' });
  const rows = [
    { imei: '350000000000011', recipient: { id: '7', name: 'Portal Zahoor Technician' } },
    { imei: '350000000000029', recipient: { id: '7', name: 'Portal Zahoor Technician' } },
    { imei: '350000000000037', recipient: { id: '9', name: 'Somebody Else' } },
  ];
  const preview = await previewHandovers(rows);
  const zahoor = preview.groups.find((group) => group.shezzName.includes('Zahoor'));
  assert.equal(zahoor.match.name, 'Portal Zahoor');
  assert.equal(zahoor.newDevices, 2);
  assert.equal(preview.groups.find((group) => group.shezzName === 'Somebody Else').match, null);

  const done = await applyHandovers(rows, {}, { id: undefined }, 'the technician stock portal');
  assert.equal(done.created, 2);
  assert.deepEqual(done.skippedNames, ['Somebody Else']);
  assert.match((await Device.findOne({ imei: '350000000000011' })).notes, /technician stock portal/);
  assert.equal((await applyHandovers(rows, {}, { id: undefined })).created, 0, 'a second run adds nothing');
});

test('technician-stock portal readings serve installation tests only when no customer portal lists the device', async () => {
  const { __setTrackingCache, getDeviceTelemetry, __setTechnicianStockCache } = await import('../src/modules/tracking/tracking.service.js');
  __setTrackingCache([{ imei: '350000000000045', gpsState: 'online', portalSource: 'Portal 1' }]);
  __setTechnicianStockCache([
    { imei: '350000000000045', gpsState: 'offline', portalSource: 'Technician stock' },
    { imei: '350000000000052', gpsState: 'online', ignitionOn: true, portalSource: 'Technician stock' },
  ]);
  assert.equal(getDeviceTelemetry('350000000000045').portalSource, 'Portal 1');
  const fallback = getDeviceTelemetry('350000000000052');
  assert.equal(fallback.found, true);
  assert.equal(fallback.portalSource, 'Technician stock');
  assert.equal(getDeviceTelemetry('350000000000060').found, false);
});
