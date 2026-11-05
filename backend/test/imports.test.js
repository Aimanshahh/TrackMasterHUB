import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import ExcelJS from 'exceljs';

import { suggestMapping } from '../src/modules/imports/automap.js';
import { normalizeRow, parseDateText } from '../src/modules/imports/normalize.js';
import { parseUpload } from '../src/modules/imports/parse.js';
import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

const csv = (text) => Buffer.from(text, 'utf8');

test('column mapping is suggested from common header names', () => {
  const headers = ['Old ID', 'Customer Name', 'Mobile No.', 'Reg No', 'Make', 'Engine', 'Chasis No', 'Color', 'Install Date', 'IMEI', 'Remarks', 'Branch'];
  const m = suggestMapping(headers);
  assert.equal(m.legacyId, 'Old ID');
  assert.equal(m.name, 'Customer Name');
  assert.equal(m.phone, 'Mobile No.');
  assert.equal(m.registration, 'Reg No');
  assert.equal(m.makeModel, 'Make');
  assert.equal(m.chassisNo, 'Chasis No');
  assert.equal(m.colour, 'Color');
  assert.equal(m.installedAt, 'Install Date');
  assert.equal(m.deviceImei, 'IMEI');
  assert.equal(m.notes, 'Remarks');
  assert.equal(Object.values(m).filter((h) => h === 'Branch').length, 0);
});

test('dates in common Pakistani formats are read, nonsense is not', () => {
  for (const text of ['25-09-2026', '25/09/2026', '2026-09-25', '25-Sep-2026', '25.9.2026']) {
    assert.equal(parseDateText(text).toISOString().slice(0, 10), '2026-09-25', text);
  }
  assert.equal(parseDateText('31-02-2026'), null);
  assert.equal(parseDateText('soon'), null);
});

test('rows are validated and unmapped columns are kept', () => {
  const headers = ['Name', 'Phone', 'Reg', 'Date', 'Branch'];
  const mapping = { name: 'Name', phone: 'Phone', registration: 'Reg', installedAt: 'Date' };
  const ok = normalizeRow(['Ali', '0300-1234567', 'abc 123', '01-01-2026', 'Lahore'], headers, mapping);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.plateKey, 'ABC123');
  assert.deepEqual(ok.extra, { Branch: 'Lahore' });

  const bad = normalizeRow(['', '123', '', 'tomorrow', ''], headers, mapping);
  assert.ok(bad.errors.length >= 3);
  const future = normalizeRow(['Ali', '03001234567', 'X-1', '01-01-2999', ''], headers, mapping);
  assert.match(future.errors.join(' '), /future/);
});

test('CSV (with BOM and quoted commas) and real .xlsx files are parsed; other files are refused', async () => {
  const c = await parseUpload(csv('﻿Name,Phone,Address\n"Khan, Ali",03001234567,"Shop 1, Karachi"\n\n'), 'a.csv');
  assert.deepEqual(c.headers, ['Name', 'Phone', 'Address']);
  assert.equal(c.rows.length, 1);
  assert.equal(c.rows[0].cells[0], 'Khan, Ali');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Customers');
  ws.addRow(['Name', 'Phone', 'Installed']);
  ws.addRow(['Sara', '03211234567', new Date(Date.UTC(2026, 8, 25))]);
  const x = await parseUpload(Buffer.from(await wb.xlsx.writeBuffer()), 'a.xlsx');
  assert.equal(x.rows[0].cells[2], '2026-09-25');

  await assert.rejects(parseUpload(Buffer.from('%PDF-1.4 hello'), 'a.pdf'), (e) => /Excel|CSV/.test(e.message));
  await assert.rejects(parseUpload(csv('only,a,header\n'), 'a.csv'), (e) => /header row/.test(e.message));
});

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx;
let svc;
let Customer;
let Job;
let ImportBatch;
let manager;
let server;
let base;
const actor = () => ({ id: ctx.admin._id.toString(), role: 'admin' });

const FILE = [
  'Old ID,Customer Name,Mobile No,Reg No,Make,Install Date,Branch',
  'L-1,Ahmed Raza,0321-1111111,LEA-100,Honda City,10-01-2025,Lahore',
  'L-1,Ahmed Raza,0321-1111111,LEA-200,Suzuki Cultus,12-03-2025,Lahore',
  'L-2,Sana Malik,0333-2222222,KHI-300,Toyota Yaris,05-05-2025,Karachi',
  ',Basheer Ahmed,0300-1234567,NEW-400,Corolla,01-06-2025,Rawalpindi',
  'L-3,No Phone,,ZZZ-1,Car,01-01-2025,x',
  'L-4,Dup Plate,0345-4444444,AYM-118,Car,01-01-2025,x',
  'L-5,Second Row Dup,0345-5555555,KHI-300,Car,01-01-2025,x',
].join('\n');

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics(); // existing customer "Basheer Ahmed" 03001234567 with vehicle AYM-118
  svc = await import('../src/modules/imports/imports.service.js');
  ({ default: Customer } = await import('../src/models/Customer.js'));
  ({ default: Job } = await import('../src/models/Job.js'));
  ({ default: ImportBatch } = await import('../src/models/ImportBatch.js'));
  const { default: User } = await import('../src/models/User.js');
  manager = await User.create({ name: 'Mgr', email: 'mgr@example.com', passwordHash: 'a-long-test-password', role: 'manager' });
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  if (hasDb) await closeTestDb();
});

async function loginCookie(email) {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'a-long-test-password' }) });
  assert.equal(res.status, 200);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

let batchId;
let previewHash;

test('upload, preview and confirm over HTTP: admin only', { skip }, async () => {
  const adminCookie = await loginCookie('admin@example.com');
  const mgrCookie = await loginCookie('mgr@example.com');

  const denied = await fetch(`${base}/imports/upload`, { method: 'POST', headers: { cookie: mgrCookie, 'content-type': 'application/octet-stream', 'x-file-name': 'c.csv' }, body: FILE });
  assert.equal(denied.status, 403);
  assert.equal((await fetch(`${base}/imports`)).status, 401);

  const up = await fetch(`${base}/imports/upload`, { method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/octet-stream', 'x-file-name': 'customers.csv' }, body: FILE });
  assert.equal(up.status, 201);
  const upBody = (await up.json()).data;
  batchId = upBody.batch.id;
  assert.equal(upBody.batch.rowCount, 7);
  assert.equal(upBody.batch.mapping.legacyId, 'Old ID');

  const prev = await fetch(`${base}/imports/${batchId}/preview`, { method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json' }, body: JSON.stringify({ mapping: upBody.batch.mapping, options: { onExisting: 'attach' } }) });
  assert.equal(prev.status, 200);
  const p = (await prev.json()).data;
  previewHash = p.batch.previewHash;
  const s = p.batch.summary;
  assert.equal(s.newCustomers, 2); // Ahmed (2 vehicles, one profile), Sana
  assert.equal(s.newVehicles, 4); // LEA-100, LEA-200, KHI-300, NEW-400 (added to existing Basheer)
  assert.equal(s.errors, 1); // no phone
  assert.equal(s.duplicates, 2); // AYM-118 in DB, KHI-300 again in file

  // Nothing was written by the preview.
  assert.equal(await Customer.countDocuments({ 'legacy.imported': true }), 0);
  assert.equal(await Job.countDocuments({ 'legacy.imported': true }), 0);
});

test('confirm needs the exact preview, imports once, and a retry changes nothing', { skip }, async () => {
  await assert.rejects(svc.confirmBatch(batchId, { previewHash: 'wrong' }, actor()), (e) => /out of date/.test(e.message));

  const [a, b] = await Promise.allSettled([svc.confirmBatch(batchId, { previewHash }, actor()), svc.confirmBatch(batchId, { previewHash }, actor())]);
  const ok = [a, b].filter((r) => r.status === 'fulfilled');
  assert.ok(ok.length >= 1);

  const retry = await svc.confirmBatch(batchId, { previewHash }, actor());
  assert.equal(retry.repeated, true);

  assert.equal(await Customer.countDocuments({ 'legacy.imported': true }), 2);
  assert.equal(await Job.countDocuments({ 'legacy.imported': true }), 4);
  assert.equal(await Customer.countDocuments({ phone: /1234567/ }), 1); // Basheer was not duplicated
});

test('legacy data is preserved, existing records untouched, and legacy customers skip onboarding', { skip }, async () => {
  const ahmed = await Customer.findOne({ 'legacy.legacyId': 'L-1' });
  assert.equal(ahmed.accountStatus, 'active');
  assert.equal(ahmed.briefingCompleted, false);
  assert.equal(ahmed.legacy.extra.Branch, 'Lahore');
  assert.equal(await Job.countDocuments({ customer: ahmed._id }), 2);

  const jobs = await Job.find({ customer: ahmed._id }).sort({ 'vehicle.registration': 1 });
  assert.equal(jobs[0].vehicle.registration, 'LEA-100');
  assert.equal(jobs[0].completedAt.toISOString().slice(0, 10), '2025-01-10');
  assert.equal(jobs[0].legacy.legacyId, 'L-1');

  const basheer = await Customer.findOne({ phone: /1234567/ });
  assert.equal(basheer.name, 'Basheer Ahmed');
  assert.ok(!basheer.legacy?.imported);
  assert.equal(await Job.countDocuments({ customer: basheer._id }), 2); // AYM-118 + NEW-400 attached

  const mgr = await import('../src/modules/manager/manager.service.js');
  const pending = await mgr.listBriefingPending({});
  assert.ok(!pending.data.some((row) => row.name === 'Ahmed Raza' || row.name === 'Sana Malik'));
  const queue = await mgr.listBillingQueue({});
  assert.ok(!queue.data.some((job) => job.legacy?.imported));
  const lookup = await mgr.listCustomers({ installedOnly: true });
  assert.ok(lookup.data.some((row) => row.name === 'Ahmed Raza')); // visible on the manager desk
});

test('uploading the same file again imports nothing new', { skip }, async () => {
  const again = await svc.createBatchFromUpload(Buffer.from(FILE), 'customers.csv', actor());
  assert.equal(again.alreadyImported.id, batchId);
  const prev = await svc.previewBatch(again.batch.id, { mapping: again.batch.mapping });
  assert.equal(prev.batch.summary.newCustomers, 0);
  assert.equal(prev.batch.summary.newVehicles, 0);
  await svc.confirmBatch(again.batch.id, { previewHash: prev.batch.previewHash }, actor());
  assert.equal(await Customer.countDocuments({ 'legacy.imported': true }), 2);
  assert.equal(await Job.countDocuments({ 'legacy.imported': true }), 4);
});

test('skip mode leaves existing customers alone, history and error report are available', { skip }, async () => {
  const up = await svc.createBatchFromUpload(Buffer.from('Name,Phone,Reg\nBasheer Ahmed,03001234567,SKP-1\n'), 'skip.csv', actor());
  const prev = await svc.previewBatch(up.batch.id, { mapping: up.batch.mapping, options: { onExisting: 'skip' } });
  assert.equal(prev.batch.summary.newVehicles, 0);
  await svc.confirmBatch(up.batch.id, { previewHash: prev.batch.previewHash }, actor());
  assert.equal(await Job.countDocuments({ 'vehicle.registration': 'SKP-1' }), 0);

  const history = await svc.listBatches({});
  assert.ok(history.data.length >= 3);
  assert.ok(history.data[0].status === 'completed');

  const errors = await svc.getBatchRows(batchId, { status: 'error' });
  assert.equal(errors.meta.total, 1);
  const { csv: report } = await svc.batchReportCsv(batchId);
  assert.match(report, /Phone number is missing/);
});

test('a column mapped twice or a missing name/phone mapping is refused', { skip }, async () => {
  const up = await svc.createBatchFromUpload(Buffer.from('A,B\nx,03001234567\n'), 'm.csv', actor());
  await assert.rejects(svc.previewBatch(up.batch.id, { mapping: { name: 'A', phone: 'A' } }), (e) => /two different fields/.test(e.message));
  await assert.rejects(svc.previewBatch(up.batch.id, { mapping: { name: 'A' } }), (e) => /phone/.test(e.message));
});
