import { useState } from 'react';

import PaymentLedger from '../../components/billing/PaymentLedger.jsx';
import { PAYMENT_METHOD_OPTIONS } from '../../app/billing.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { usePayments } from '../../hooks/useBilling.js';
import { formatMoney } from '../../lib/format.js';

export default function ManagerPaymentsPage() {
  useDocumentTitle('Payments');
  const [filters, setFilters] = useState({ q: '', method: '', from: '', to: '' });
  const payments = usePayments(filters);

  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const hasFilters = Boolean(filters.q || filters.method || filters.from || filters.to);

  return (
    <div className="payments-page">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Money received</h2>
            <p className="panel__meta">
              {payments.meta?.total ?? payments.rows.length} {(payments.meta?.total ?? payments.rows.length) === 1 ? 'payment' : 'payments'}
              {payments.meta ? ` · ${formatMoney(payments.meta.sum)} in this view` : ''}
            </p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={payments.refresh}>
            {payments.status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="ledger-toolbar ledger-toolbar--payments">
          <div className="ledger-toolbar__search">
            <input
              className="input"
              aria-label="Search payments"
              placeholder="Payment, customer or bank reference…"
              value={filters.q}
              onChange={update('q')}
            />
          </div>
          <label className="ledger-toolbar__field">
            <span>Method</span>
            <select className="input" value={filters.method} onChange={update('method')}>
              <option value="">Any method</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="ledger-toolbar__field">
            <span>From</span>
            <input className="input" type="date" value={filters.from} onChange={update('from')} />
          </label>
          <label className="ledger-toolbar__field">
            <span>To</span>
            <input className="input" type="date" value={filters.to} onChange={update('to')} />
          </label>
          {hasFilters ? (
            <button type="button" className="sp-text-btn" onClick={() => setFilters({ q: '', method: '', from: '', to: '' })}>
              Clear
            </button>
          ) : null}
        </div>

        {payments.error ? <p className="app-notice app-notice--error" role="alert">Payments could not be loaded: {payments.error}</p> : null}
        {payments.status === 'loading' ? <p className="data-state" role="status">Loading payments…</p> : null}

        {payments.status !== 'loading' ? (
          <PaymentLedger
            payments={payments.rows}
            eyebrow={payments.meta ? `Total in this view · ${payments.meta.total} payments` : null}
            emptyMessage={hasFilters ? 'No payment matches these filters.' : 'Record a payment against an issued invoice and it appears here with its full history.'}
          />
        ) : null}
      </section>

      <p className="ledger-note">
        Payments are append-only. Nothing on this screen edits or deletes a received amount; a mistake is corrected with a
        reversing entry, so the ledger always matches what the business actually banked.
      </p>
    </div>
  );
}
