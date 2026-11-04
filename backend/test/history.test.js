import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { buildTimeline, describeDuration, timeToResolveMs } from '../src/utils/timeline.js';
import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

test('describeDuration reads naturally', () => {
  assert.equal(describeDuration(null), null);
  assert.equal(describeDuration(20_000), 'under a minute');
  assert.equal(describeDuration(65 * 60_000), '1 hour 5 minutes');
  assert.equal(describeDuration((3 * 1440 + 4 * 60) * 60_000), '3 days 4 hours');
});

test('timeToResolveMs uses the first resolved entry and is null while open', () => {
  const createdAt = new Date('2026-10-01T10:00:00Z');
  assert.equal(timeToResolveMs({ createdAt, history: [{ status: 'in_progress', at: new Date('2026-10-01T11:00:00Z') }] }), null);
  assert.equal(
    timeToResolveMs({
      createdAt,
      history: [
        { status: 'closed', at: new Date('2026-10-03T10:00:00Z') },
        { status: 'resolved', at: new Date('2026-10-02T10:00:00Z') },
      ],
    }),
    24 * 3600_000,
  );
});

test('buildTimeline is newest first and omits money unless allowed', () => {
  const input = {
    customer: { createdAt: new Date('2026-10-01T00:00:00Z') },
    invoices: [{ reference: 'INV-1', issuedAt: new Date('2026-10-05T00:00:00Z') }],
    payments: [{ reference: 'PAY-1', receivedAt: new Date('2026-10-06T00:00:00Z') }],
  };
  const without = buildTimeline(input);
  assert.equal(without.length, 1);
  const withMoney = buildTimeline(input, { includeMoney: true });
  assert.deepEqual(withMoney.map((e) => e.kind), ['money', 'money', 'customer']);
  assert.ok(new Date(withMoney[0].at) > new Date(withMoney[1].at));
});

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx;
let history;
let Complaint;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  history = await import('../src/modules/customers/history.service.js');
  ({ default: Complaint } = await import('../src/models/Complaint.js'));
  await Complaint.create({
    customer: ctx.customer._id,
    customerName: ctx.customer.name,
    title: 'Device offline',
    createdAt: new Date('2026-10-10T08:00:00Z'),
    createdBy: ctx.sales._id,
    status: 'resolved',
    history: [
      { status: 'in_progress', note: 'Technician booked', at: new Date('2026-10-10T09:00:00Z') },
      { status: 'resolved', note: 'Replaced SIM', at: new Date('2026-10-10T10:00:00Z') },
    ],
  });
});

after(async () => {
  if (hasDb) await closeTestDb();
});

test('report never carries CNIC, date of birth or E-PIN', { skip }, async () => {
  const { default: Customer } = await import('../src/models/Customer.js');
  await Customer.updateOne({ _id: ctx.customer._id }, { briefing: { cnic: '3520112345671', dob: new Date('1990-01-01'), ePin: '4821' } });
  const report = await history.getCustomerHistory(ctx.customer._id, { id: ctx.admin._id.toString(), role: 'admin' });
  const text = JSON.stringify(report);
  assert.ok(!text.includes('3520112345671'));
  assert.ok(!text.includes('4821'));
  assert.ok(!text.includes('1990-01-01'));
  assert.equal(report.calls.label, 'Call data not connected');
  assert.equal(report.installations.length, 1);
  assert.equal(report.complaints[0].timeToResolve, '2 hours');
});

test('salesperson sees their own customer without money; another salesperson is refused', { skip }, async () => {
  const own = await history.getCustomerHistory(ctx.customer._id, { id: ctx.sales._id.toString(), role: 'salesperson' });
  assert.equal(own.money, null);
  assert.equal(own.includesMoney, false);

  await assert.rejects(
    history.getCustomerHistory(ctx.customer._id, { id: ctx.admin._id.toString().replace(/.$/, '0'), role: 'salesperson' }),
    (error) => /not allowed/.test(error.message),
  );
});

test('manager sees the money section', { skip }, async () => {
  const report = await history.getCustomerHistory(ctx.customer._id, { id: ctx.admin._id.toString(), role: 'manager' });
  assert.ok(report.money);
  assert.ok(report.money.totals.every((row) => row.source));
});
