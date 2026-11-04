import { useEffect, useState } from 'react';

import { PAYMENT_METHOD_OPTIONS } from '../../app/billing.js';
import { issueCreditNoteRecord, recordRefundRecord } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';

/**
 * One drawer for the two corrections to an issued invoice.
 *
 * A credit note lowers what the customer owes. A refund hands back money the
 * customer already paid, and only an overpayment can be refunded, which is why
 * the credit note comes first. Both need a written reason that is printed on the
 * document and kept in the audit trail, and neither can be edited afterwards.
 */
export default function AdjustmentDrawer({ invoice, kind, open, onClose, onDone }) {
  const isRefund = kind === 'refund';
  const limit = isRefund ? invoice?.refundable ?? 0 : invoice?.creditable ?? 0;
  const [form, setForm] = useState({ amount: '', reason: '', method: 'cash', transactionRef: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !invoice) return;
    setForm({ amount: String(limit), reason: '', method: 'cash', transactionRef: '' });
    setError(null);
    setSaving(false);
  }, [open, invoice, limit]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open || !invoice) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const amount = Number(form.amount);
  const validAmount = Number.isFinite(amount) && amount > 0;

  // What a credit note of this size would leave: the customer either still owes
  // money, or has overpaid and is owed a refund.
  const netAfter = Math.round(((invoice.netAmount ?? invoice.amount) - (validAmount ? amount : 0)) * 100) / 100;
  const received = invoice.netReceived ?? invoice.paidAmount;
  const owedBack = Math.max(0, Math.round((received - netAfter) * 100) / 100);
  const stillOwed = Math.max(0, Math.round((netAfter - received) * 100) / 100);

  async function submit(event) {
    event.preventDefault();
    setError(null);

    if (!validAmount) return setError('Enter an amount greater than zero.');
    if (amount > limit) {
      return setError(isRefund
        ? `A refund cannot be more than the ${formatMoney(limit)} owed back to the customer.`
        : `A credit note cannot be more than the ${formatMoney(limit)} that can still be credited.`);
    }
    if (form.reason.trim().length < 3) return setError('Write the reason. It is printed on the document.');

    setSaving(true);
    try {
      const payload = await (isRefund
        ? recordRefundRecord(invoice.id, { amount, reason: form.reason, method: form.method, transactionRef: form.transactionRef })
        : issueCreditNoteRecord(invoice.id, { amount, reason: form.reason }));
      await onDone?.(payload.data, kind);
      onClose();
    } catch (error_) {
      setError(error_.message || `The ${isRefund ? 'refund' : 'credit note'} could not be recorded.`);
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="adjustment-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{invoice.reference} · {invoice.customer?.name || 'Customer'}</p>
            <h2 className="drawer__title" id="adjustment-title">{isRefund ? 'Record a refund' : 'Issue a credit note'}</h2>
            <p className="drawer__subtitle">
              {isRefund
                ? 'Money handed back to the customer after a credit note left them overpaid.'
                : 'Lowers what the customer owes on this invoice. The invoice amount itself never changes.'}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <dl className="pay-figures">
            <div><dt>Invoice total</dt><dd>{formatMoney(invoice.amount, invoice.currency)}</dd></div>
            <div><dt>Credit notes so far</dt><dd>{formatMoney(invoice.creditedAmount ?? 0, invoice.currency)}</dd></div>
            <div><dt>Received, less refunds</dt><dd>{formatMoney(received, invoice.currency)}</dd></div>
            <div className="pay-figures__due">
              <dt>{isRefund ? 'Owed back to customer' : 'Can still be credited'}</dt>
              <dd>{formatMoney(limit, invoice.currency)}</dd>
            </div>
          </dl>

          <div className="drawer__section-label">{isRefund ? 'This refund' : 'This credit note'}</div>

          <label className="field">
            <span className="field__label">Amount <i>Required</i></span>
            <div className="money-input">
              <em aria-hidden="true">PKR</em>
              <input className="input" type="number" min="1" step="1" inputMode="decimal" value={form.amount} onChange={update('amount')} autoFocus required />
            </div>
          </label>

          <label className="field">
            <span className="field__label">Reason <i>Required</i></span>
            <input
              className="input"
              maxLength={400}
              placeholder={isRefund ? 'e.g. Overpaid after discount, returned in cash' : 'e.g. Discount agreed with the customer'}
              value={form.reason}
              onChange={update('reason')}
              required
            />
            <span className="field__hint">Printed on the document and kept in the activity log. It cannot be changed later.</span>
          </label>

          {isRefund ? (
            <div className="field-grid">
              <label className="field">
                <span className="field__label">Paid back by</span>
                <select className="input" value={form.method} onChange={update('method')}>
                  {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Reference</span>
                <input className="input" maxLength={120} placeholder="Bank reference or cheque number" value={form.transactionRef} onChange={update('transactionRef')} />
              </label>
            </div>
          ) : (
            <p className="pay-outcome" data-state={owedBack > 0 ? 'open' : 'settled'} role="status">
              {!validAmount
                ? 'Enter the amount to see what the customer owes afterwards.'
                : owedBack > 0
                  ? `The customer will have overpaid by ${formatMoney(owedBack, invoice.currency)}. Record a refund next to give it back.`
                  : stillOwed > 0
                    ? `The customer will still owe ${formatMoney(stillOwed, invoice.currency)} after this credit note.`
                    : 'After this credit note nothing is owed on the invoice.'}
            </p>
          )}

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Recording…' : isRefund ? 'Record refund' : 'Issue credit note'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
