import { useEffect, useState } from 'react';

import { PAYMENT_METHOD_OPTIONS } from '../../app/billing.js';
import { formatMoney } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Records one instalment against an invoice. Partial payment is expected, so the
 * form starts at the remaining balance and offers the common splits rather than
 * forcing staff to work out the arithmetic.
 */
export default function PaymentDrawer({ invoice, open, onClose, onSubmit }) {
  const [form, setForm] = useState({ amount: '', method: 'cash', receivedAt: today(), transactionRef: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !invoice) return;
    setForm({ amount: String(invoice.balance), method: 'cash', receivedAt: today(), transactionRef: '', note: '' });
    setError(null);
    setSaving(false);
  }, [open, invoice]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open || !invoice) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const amount = Number(form.amount);
  const remaining = Math.max(0, Math.round((invoice.balance - (Number.isFinite(amount) ? amount : 0)) * 100) / 100);

  async function submit(event) {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter the amount the customer paid.');
    if (amount > invoice.balance) return setError(`That is more than the ${formatMoney(invoice.balance)} still owed on this invoice.`);
    if (form.transactionRef.trim() && form.method === 'cash') {
      // Cash rarely has a reference; an empty one is fine, so this is only a hint.
    }

    setSaving(true);
    try {
      await onSubmit(invoice.id, {
        amount,
        method: form.method,
        receivedAt: form.receivedAt,
        transactionRef: form.transactionRef,
        note: form.note,
      });
      onClose();
    } catch (error_) {
      setError(error_.message || 'The payment could not be recorded.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close payment form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{invoice.reference} · {invoice.customer?.name || 'Customer'}</p>
            <h2 className="drawer__title" id="payment-title">Record a payment</h2>
            <p className="drawer__subtitle">
              {invoice.balance < invoice.amount
                ? 'This invoice is partly paid, so only the remaining balance can be received against it.'
                : 'Record the amount actually received. A part payment is recorded as its own entry.'}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <dl className="pay-figures">
            <div><dt>Invoice total</dt><dd>{formatMoney(invoice.amount, invoice.currency)}</dd></div>
            <div><dt>Already received</dt><dd>{formatMoney(invoice.paidAmount, invoice.currency)}</dd></div>
            <div className="pay-figures__due"><dt>Balance</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
          </dl>

          <div className="drawer__section-label">This instalment</div>

          <label className="field">
            <span className="field__label">Amount received <i>Required</i></span>
            <div className="money-input">
              <em aria-hidden="true">PKR</em>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={form.amount}
                onChange={update('amount')}
                autoFocus
                required
              />
            </div>
          </label>

          <div className="pay-splits" role="group" aria-label="Quick amounts">
            <button type="button" onClick={() => setForm((current) => ({ ...current, amount: String(invoice.balance) }))}>
              Full balance · {formatMoney(invoice.balance)}
            </button>
            <button type="button" onClick={() => setForm((current) => ({ ...current, amount: String(Math.round(invoice.balance / 2)) }))}>
              Half · {formatMoney(Math.round(invoice.balance / 2))}
            </button>
          </div>

          <div className="field-grid">
            <label className="field">
              <span className="field__label">Method</span>
              <select className="input" value={form.method} onChange={update('method')}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Date received</span>
              <input className="input" type="date" value={form.receivedAt} max={today()} onChange={update('receivedAt')} />
            </label>
            <label className="field field--full">
              <span className="field__label">Reference</span>
              <input className="input" maxLength={120} placeholder="Cheque number, bank reference or transaction id" value={form.transactionRef} onChange={update('transactionRef')} />
            </label>
            <label className="field field--full">
              <span className="field__label">Note</span>
              <input className="input" maxLength={400} placeholder="Anything the next person should know about this payment" value={form.note} onChange={update('note')} />
            </label>
          </div>

          <p className="pay-outcome" data-state={remaining === 0 ? 'settled' : 'open'} role="status">
            {Number.isFinite(amount) && amount > 0
              ? remaining === 0
                ? 'This settles the invoice in full.'
                : `${formatMoney(remaining, invoice.currency)} will remain outstanding after this payment.`
              : 'Enter the amount to see the remaining balance.'}
          </p>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Recording…' : 'Record payment'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
