import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, makeCompletedJob, seedBasics } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';

let ctx;
let billing;
let Activity;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics({ price: 20000 });
  billing = await import('../src/modules/billing/billing.service.js');
  ({ default: Activity } = await import('../src/models/Activity.js'));
});

after(async () => {
  if (hasDb) await closeTestDb();
});

async function newIssuedInvoice(amount = 20000) {
  const job = await makeCompletedJob(ctx, { price: amount });
  const draft = await billing.createInvoice({ jobId: job._id.toString(), amount }, ctx.actor);
  return billing.issueInvoice(draft.id, ctx.actor);
}

const rejects = (promise, pattern) => assert.rejects(promise, (error) => pattern.test(error.message));

test('credit notes and refunds are refused on a draft invoice', { skip }, async () => {
  const draft = await billing.createInvoice({ jobId: ctx.job._id.toString(), amount: 20000 }, ctx.actor);
  await rejects(billing.issueCreditNote(draft.id, { amount: 100, reason: 'Goodwill' }, ctx.actor), /Issue this invoice/);
  await rejects(billing.recordRefund(draft.id, { amount: 100, reason: 'Goodwill' }, ctx.actor), /Issue this invoice/);
});

test('a credit note needs a reason and a sensible amount', { skip }, async () => {
  const invoice = await newIssuedInvoice();
  await rejects(billing.issueCreditNote(invoice.id, { amount: 1000, reason: '' }, ctx.actor), /reason/i);
  await rejects(billing.issueCreditNote(invoice.id, { amount: 0, reason: 'Goodwill' }, ctx.actor), /greater than zero/);
  await rejects(billing.issueCreditNote(invoice.id, { amount: 20001, reason: 'Too much' }, ctx.actor), /cannot be more than/);
});

test('a credit note lowers the balance and the customer then pays only the net amount', { skip }, async () => {
  const invoice = await newIssuedInvoice();
  const result = await billing.issueCreditNote(invoice.id, { amount: 5000, reason: 'Discount agreed on the phone' }, ctx.actor);

  assert.match(result.adjustment.reference, /^CRN-/);
  assert.equal(result.invoice.amount, 20000, 'the invoice amount never changes');
  assert.equal(result.invoice.creditedAmount, 5000);
  assert.equal(result.invoice.netAmount, 15000);
  assert.equal(result.invoice.balance, 15000);

  await rejects(billing.recordPayment(invoice.id, { amount: 15001, method: 'cash' }, ctx.actor), /more than the/);
  const paid = await billing.recordPayment(invoice.id, { amount: 15000, method: 'cash' }, ctx.actor);
  assert.equal(paid.invoice.balance, 0);
  assert.equal(paid.invoice.paymentState, 'paid');
});

test('only an overpayment can be refunded, and a refund cannot exceed it', { skip }, async () => {
  const invoice = await newIssuedInvoice();
  await billing.recordPayment(invoice.id, { amount: 20000, method: 'bank_transfer', transactionRef: 'TX-1' }, ctx.actor);

  // Paid in full and not credited: there is nothing to give back yet.
  await rejects(billing.recordRefund(invoice.id, { amount: 1000, reason: 'Cancelled' }, ctx.actor), /Issue a credit note first/);

  const credited = await billing.issueCreditNote(invoice.id, { amount: 5000, reason: 'Service not delivered' }, ctx.actor);
  assert.equal(credited.invoice.refundable, 5000);
  assert.equal(credited.invoice.paymentState, 'refund_due');

  await rejects(billing.recordRefund(invoice.id, { amount: 5001, reason: 'Too much' }, ctx.actor), /cannot be more than/);
  await rejects(billing.recordRefund(invoice.id, { amount: 1000, reason: '' }, ctx.actor), /reason/i);

  const refund = await billing.recordRefund(invoice.id, { amount: 5000, method: 'cash', reason: 'Returned in cash' }, ctx.actor);
  assert.match(refund.adjustment.reference, /^RFD-/);
  assert.equal(refund.invoice.refundedAmount, 5000);
  assert.equal(refund.invoice.refundable, 0);
  assert.equal(refund.invoice.netReceived, 15000);
  assert.equal(refund.invoice.paymentState, 'paid');

  await rejects(billing.recordRefund(invoice.id, { amount: 1, reason: 'Again' }, ctx.actor), /Nothing is owed back/);
});

test('a credited invoice cannot be cancelled, and credits cannot exceed the amount', { skip }, async () => {
  const invoice = await newIssuedInvoice();
  await billing.issueCreditNote(invoice.id, { amount: 12000, reason: 'Part credit' }, ctx.actor);
  await rejects(billing.cancelInvoice(invoice.id, { reason: 'Mistake' }, ctx.actor), /credit notes/);
  await rejects(billing.issueCreditNote(invoice.id, { amount: 8001, reason: 'Too much' }, ctx.actor), /cannot be more than the .*8,000/);
  const rest = await billing.issueCreditNote(invoice.id, { amount: 8000, reason: 'The rest' }, ctx.actor);
  assert.equal(rest.invoice.paymentState, 'credited');
  await rejects(billing.issueCreditNote(invoice.id, { amount: 1, reason: 'More' }, ctx.actor), /already been credited in full/);
});

test('invoice detail lists the instalments and the adjustments together', { skip }, async () => {
  const invoice = await newIssuedInvoice();
  await billing.recordPayment(invoice.id, { amount: 20000, method: 'cash' }, ctx.actor);
  await billing.issueCreditNote(invoice.id, { amount: 2000, reason: 'Goodwill' }, ctx.actor);
  await billing.recordRefund(invoice.id, { amount: 2000, method: 'cash', reason: 'Goodwill refund' }, ctx.actor);

  const detail = await billing.getInvoiceDetail(invoice.id);
  assert.equal(detail.payments.length, 1);
  assert.deepEqual(detail.adjustments.map((row) => row.kind), ['credit_note', 'refund']);

  const printable = await billing.getAdjustmentDetail(detail.adjustments[0].id);
  assert.equal(printable.invoice.reference, invoice.reference);
});

test('the list filter and the money totals both account for credits and refunds', { skip }, async () => {
  const before = await billing.getBillingSummary();

  const invoice = await newIssuedInvoice(10000);
  await billing.recordPayment(invoice.id, { amount: 10000, method: 'cash' }, ctx.actor);
  await billing.issueCreditNote(invoice.id, { amount: 4000, reason: 'Summary check' }, ctx.actor);

  const refundDue = await billing.listInvoices({ paymentState: 'refund_due' });
  assert.ok(refundDue.data.some((row) => row.id === invoice.id));

  const after = await billing.getBillingSummary();
  assert.equal(after.invoiced - before.invoiced, 6000, 'invoiced is the amount net of credit notes');
  assert.equal(after.collected - before.collected, 10000);
  assert.equal(after.refundDue - before.refundDue, 4000);
  assert.equal(after.creditedTotal - before.creditedTotal, 4000);
  assert.equal(after.outstanding - before.outstanding, 0, 'nothing is owed by the customer');

  await billing.recordRefund(invoice.id, { amount: 4000, method: 'cash', reason: 'Summary check refund' }, ctx.actor);
  const last = await billing.getBillingSummary();
  assert.equal(last.refundDue, before.refundDue);
  assert.equal(last.refundedTotal - before.refundedTotal, 4000);
  assert.equal(last.collected - before.collected, 6000, 'collected is what the business actually kept');
});

test('every credit note and refund leaves an audit entry', { skip }, async () => {
  const types = (await Activity.find({}).lean()).map((row) => row.type);
  assert.ok(types.includes('credit_note.issued'));
  assert.ok(types.includes('refund.recorded'));
});
