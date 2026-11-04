/**
 * The one place invoice money is worked out, so the invoice model, the totals
 * on the money screens and the printed documents can never disagree.
 *
 * An invoice's own `amount` never changes. Two append-only records adjust it:
 *  - credit notes lower what the customer owes (credited amount);
 *  - refunds return money the customer already paid (refunded amount).
 * Payments only ever add to `paidAmount`.
 */

export const round2 = (value) => Math.round(Number(value) * 100) / 100;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function invoiceFigures(invoice) {
  const amount = num(invoice.amount);
  const credited = Math.min(amount, Math.max(0, num(invoice.creditedAmount)));
  const paid = Math.max(0, num(invoice.paidAmount));
  const refunded = Math.min(paid, Math.max(0, num(invoice.refundedAmount)));

  const netAmount = round2(amount - credited);
  const netReceived = round2(paid - refunded);

  return {
    amount: round2(amount),
    credited: round2(credited),
    paid: round2(paid),
    refunded: round2(refunded),
    /** What the customer is finally asked to pay: the amount less credit notes. */
    netAmount,
    /** Money the business is actually holding: payments less refunds. */
    netReceived,
    /** Still owed by the customer. */
    balance: round2(Math.max(0, netAmount - netReceived)),
    /** Overpaid after a credit note, so owed back to the customer. */
    refundable: round2(Math.max(0, netReceived - netAmount)),
    /** How much more can still be credited on this invoice. */
    creditable: round2(amount - credited),
  };
}

/**
 * unpaid, partial, paid, overdue, credited (fully credited, nothing held),
 * refund_due (customer overpaid) or cancelled. Derived, never typed in by staff.
 */
export function paymentStateOf(invoice, now = new Date()) {
  if (invoice.status === 'cancelled') return 'cancelled';

  const figures = invoiceFigures(invoice);
  if (figures.refundable > 0) return 'refund_due';
  if (figures.amount > 0 && figures.netAmount === 0) return 'credited';

  const pastDue = Boolean(invoice.dueDate) && new Date(invoice.dueDate) < now;

  if (figures.netReceived >= figures.netAmount) return 'paid';
  if (figures.netReceived > 0) return pastDue ? 'overdue' : 'partial';
  return pastDue && invoice.status === 'issued' ? 'overdue' : 'unpaid';
}
