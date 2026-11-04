import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { renderComplaintEmail } from '../src/modules/messaging/templates.js';
import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

test('email templates use only customer-safe fields', () => {
  const { subject, body } = renderComplaintEmail(
    'resolved',
    { customerName: 'Basheer', reference: 'CMP-1', title: 'Device offline', resolution: 'Replaced SIM', internalNote: 'SECRET' },
    'TrackMaster',
  );
  assert.match(subject, /CMP-1/);
  assert.match(body, /Replaced SIM/);
  assert.ok(!body.includes('SECRET'));
});

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx;
let complaints;
let messaging;
let MessageDelivery;
const actor = () => ({ id: ctx.admin._id.toString(), role: 'admin' });
const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics({ email: 'customer@example.com' });
  complaints = await import('../src/modules/complaints/complaints.service.js');
  messaging = await import('../src/modules/messaging/messaging.service.js');
  ({ default: MessageDelivery } = await import('../src/models/MessageDelivery.js'));
});

after(async () => {
  messaging?.setTransportForTests(null);
  if (hasDb) await closeTestDb();
});

test('without SMTP the email is recorded as not configured and the complaint still saves', { skip }, async () => {
  messaging.setTransportForTests(null);
  const complaint = await complaints.createComplaint({ customerId: ctx.customer._id.toString(), title: 'No signal' }, { id: ctx.sales._id.toString() });
  assert.ok(complaint.id);
  const rows = await MessageDelivery.find({ complaint: complaint.id });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.channel === 'email').status, 'not_configured');
  assert.equal(rows.find((r) => r.channel === 'whatsapp').status, 'not_configured');
});

test('a working transport sends the logged email, a status change sends another, and never twice', { skip }, async () => {
  const sent = [];
  messaging.setTransportForTests({ sendMail: async (mail) => { sent.push(mail); } });
  const complaint = await complaints.createComplaint({ customerId: ctx.customer._id.toString(), title: 'Wrong plate' }, { id: ctx.sales._id.toString() });
  await wait();
  await complaints.updateComplaint(complaint.id, { status: 'resolved', resolution: 'Plate corrected' }, actor());
  await wait();
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, 'customer@example.com');
  assert.match(sent[1].text, /Plate corrected/);
  const rows = await MessageDelivery.find({ complaint: complaint.id, channel: 'email' });
  assert.deepEqual(rows.map((r) => r.status), ['sent', 'sent']);
  await messaging.queueComplaintMessages(await (await import('../src/models/Complaint.js')).default.findById(complaint.id), 'logged', 0);
  assert.equal(await MessageDelivery.countDocuments({ complaint: complaint.id, channel: 'email' }), 2);
});

test('failures retry with a delay, then fail after the last attempt, and can be retried by a person', { skip }, async () => {
  let fail = true;
  messaging.setTransportForTests({ sendMail: async () => { if (fail) throw new Error('SMTP down'); } });
  const complaint = await complaints.createComplaint({ customerId: ctx.customer._id.toString(), title: 'Battery drain' }, { id: ctx.sales._id.toString() });
  await wait();
  let row = await MessageDelivery.findOne({ complaint: complaint.id, channel: 'email' });
  assert.equal(row.status, 'retrying');
  assert.equal(row.attempts, 1);
  assert.match(row.lastError, /SMTP down/);

  for (let i = 0; i < 3; i += 1) {
    await MessageDelivery.updateOne({ _id: row._id }, { nextAttemptAt: new Date(Date.now() - 1000) });
    await messaging.sweepMessages();
  }
  row = await MessageDelivery.findById(row._id);
  assert.equal(row.status, 'failed');
  assert.equal(row.attempts, messaging.MAX_ATTEMPTS);

  fail = false;
  const retried = await messaging.retryMessage(row._id);
  assert.equal(retried.status, 'sent');
});

test('a customer with no email is recorded as not sent, and manual follow-up can be noted', { skip }, async () => {
  messaging.setTransportForTests({ sendMail: async () => {} });
  const { default: Customer } = await import('../src/models/Customer.js');
  await Customer.updateOne({ _id: ctx.customer._id }, { email: '' });
  const complaint = await complaints.createComplaint({ customerId: ctx.customer._id.toString(), title: 'Billing question' }, { id: ctx.sales._id.toString() });
  const row = await MessageDelivery.findOne({ complaint: complaint.id, channel: 'email' });
  assert.equal(row.status, 'skipped');
  const done = await messaging.markMessageManual(row._id, 'Called the customer');
  assert.equal(done.status, 'manual');
});
