process.env.ROBOCALL_WEBHOOK_SECRET = 'test-secret-value';

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { parseCallPayload } from '../src/modules/calls/payload.js';
import { phoneKey, phoneRegexFor } from '../src/utils/phone.js';
import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

const sample = { call_id: 6216606, call_to: '923452511122', status: 'ANSWERED', duration: '6s', dtmf: '', alert_id: 918, alert_type: 'LAHORE', amount: 'PKR 1,000', time: '2026-11-04T15:28:59+05:00' };

test('phone numbers match across formats', () => {
  assert.equal(phoneKey('923452511122'), '3452511122');
  assert.equal(phoneKey('0345-2511122'), '3452511122');
  assert.equal(phoneKey('+92 345 2511122'), '3452511122');
  assert.equal(phoneKey('123'), '');
  const regex = phoneRegexFor('3452511122');
  assert.ok(regex.test('0345-2511122'));
  assert.ok(regex.test('+92 345 2511122'));
  assert.ok(!regex.test('03001234567'));
});

test('payload mapping reads the provider fields and tolerates naming differences', () => {
  const mapped = parseCallPayload(sample);
  assert.equal(mapped.callId, '6216606');
  assert.equal(mapped.status, 'answered');
  assert.equal(mapped.durationSeconds, 6);
  assert.equal(mapped.alertType, 'LAHORE');
  assert.equal(mapped.amount, 1000);
  assert.equal(mapped.calledAt.toISOString(), '2026-11-04T10:28:59.000Z');

  const other = parseCallPayload({ CallTo: '03452511122', CallStatus: 'No Answer', Callid: 'x1' });
  assert.equal(other.status, 'no_answer');
  assert.equal(parseCallPayload({ nothing: 'useful' }), null);
});

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx;
let server;
let base;
let CallLog;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  const { default: Customer } = await import('../src/models/Customer.js');
  await Customer.updateOne({ _id: ctx.customer._id }, { phone: '0345-2511122' });
  ({ default: CallLog } = await import('../src/models/CallLog.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/webhooks/robocall`;
});

after(async () => {
  server?.close();
  if (hasDb) await closeTestDb();
});

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('webhook rejects a missing or wrong secret', { skip }, async () => {
  assert.equal((await post(base, sample)).status, 401);
  assert.equal((await post(`${base}?token=wrong`, sample)).status, 401);
  assert.equal(await CallLog.countDocuments(), 0);
});

test('webhook stores the call, matches the customer, and ignores a repeat', { skip }, async () => {
  const first = await post(`${base}?token=test-secret-value`, sample);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).stored, true);

  const again = await post(`${base}?token=test-secret-value`, sample);
  assert.equal((await again.json()).duplicate, true);

  const rows = await CallLog.find();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customer.toString(), ctx.customer._id.toString());
  assert.equal(rows[0].raw.alert_type, 'LAHORE');

  assert.equal((await post(`${base}?token=test-secret-value`, { junk: 1 })).status, 400);
});

test('history report shows calls to admin and hides them from the manager', { skip }, async () => {
  const history = await import('../src/modules/customers/history.service.js');
  const admin = await history.getCustomerHistory(ctx.customer._id, { id: ctx.admin._id.toString(), role: 'admin' });
  assert.equal(admin.calls.connected, true);
  assert.equal(admin.calls.rows.length, 1);

  const manager = await history.getCustomerHistory(ctx.customer._id, { id: ctx.admin._id.toString(), role: 'manager' });
  assert.equal(manager.calls.rows.length, 0);
  assert.match(manager.calls.label, /admin and operations/);
});
