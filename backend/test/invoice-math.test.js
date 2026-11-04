import assert from 'node:assert/strict';
import test from 'node:test';

import { invoiceFigures, paymentStateOf } from '../src/utils/invoiceMath.js';

const base = { status: 'issued', amount: 20000, paidAmount: 0, creditedAmount: 0, refundedAmount: 0 };
const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

test('an invoice with no payments is unpaid, and overdue once past its due date', () => {
  assert.equal(paymentStateOf({ ...base, dueDate: future }), 'unpaid');
  assert.equal(paymentStateOf({ ...base, dueDate: past }), 'overdue');
  assert.equal(invoiceFigures(base).balance, 20000);
});

test('part payment is partial, then paid when the balance reaches zero', () => {
  assert.equal(paymentStateOf({ ...base, paidAmount: 10000, dueDate: future }), 'partial');
  assert.equal(paymentStateOf({ ...base, paidAmount: 10000, dueDate: past }), 'overdue');
  assert.equal(paymentStateOf({ ...base, paidAmount: 20000 }), 'paid');
  assert.equal(invoiceFigures({ ...base, paidAmount: 10000 }).balance, 10000);
});

test('a credit note lowers what is owed without touching the invoice amount', () => {
  const figures = invoiceFigures({ ...base, creditedAmount: 5000 });
  assert.equal(figures.amount, 20000);
  assert.equal(figures.netAmount, 15000);
  assert.equal(figures.balance, 15000);
  assert.equal(figures.creditable, 15000);
});

test('paying the net amount after a credit note settles the invoice', () => {
  assert.equal(paymentStateOf({ ...base, creditedAmount: 5000, paidAmount: 15000 }), 'paid');
});

test('crediting an invoice that was already paid in full leaves a refund owed', () => {
  const invoice = { ...base, paidAmount: 20000, creditedAmount: 5000 };
  assert.equal(invoiceFigures(invoice).refundable, 5000);
  assert.equal(paymentStateOf(invoice), 'refund_due');
});

test('after the refund is paid the invoice is simply paid again', () => {
  const invoice = { ...base, paidAmount: 20000, creditedAmount: 5000, refundedAmount: 5000 };
  const figures = invoiceFigures(invoice);
  assert.equal(figures.refundable, 0);
  assert.equal(figures.netReceived, 15000);
  assert.equal(paymentStateOf(invoice), 'paid');
});

test('a fully credited and fully refunded invoice is credited, with nothing owed either way', () => {
  const invoice = { ...base, paidAmount: 20000, creditedAmount: 20000, refundedAmount: 20000 };
  const figures = invoiceFigures(invoice);
  assert.equal(figures.balance, 0);
  assert.equal(figures.refundable, 0);
  assert.equal(paymentStateOf(invoice), 'credited');
});

test('records written before credit notes existed still work', () => {
  const legacy = { status: 'issued', amount: 15000, paidAmount: 5000 };
  assert.equal(invoiceFigures(legacy).balance, 10000);
  assert.equal(paymentStateOf(legacy), 'partial');
});

test('cancelled stays cancelled and values are rounded to two places', () => {
  assert.equal(paymentStateOf({ ...base, status: 'cancelled' }), 'cancelled');
  assert.equal(invoiceFigures({ ...base, amount: 100.1, paidAmount: 0.2 }).balance, 99.9);
});
