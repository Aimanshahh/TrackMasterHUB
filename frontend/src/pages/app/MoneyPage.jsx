import { useState } from 'react';

import InvoiceTable from '../../components/billing/InvoiceTable.jsx';
import MoneyStrip from '../../components/billing/MoneyStrip.jsx';
import PaymentDrawer from '../../components/billing/PaymentDrawer.jsx';
import PaymentLedger from '../../components/billing/PaymentLedger.jsx';
import { INVOICE_FILTERS } from '../../app/billing.js';
import { useBillingSummary, useInvoices, usePayments } from '../../hooks/useBilling.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatMoney } from '../../lib/format.js';

/**
 * The admin's read-and-act view of the books. It mirrors the manager desk so the
 * admin can answer a customer question without switching accounts, and it uses
 * the same endpoints, so there is only one version of the truth.
 */
export default function MoneyPage() {
  useDocumentTitle('Money records');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [notice, setNotice] = useState(null);

  const status = filter === 'draft' ? 'draft' : '';
  const paymentState = ['unpaid', 'partial', 'paid'].includes(filter) ? filter : '';
  const invoices = useInvoices({ q: search, status, paymentState });
  const payments = usePayments({});
  const summary = useBillingSummary();

  async function issue(invoice) {
    const updated = await invoices.issue(invoice.id);
    await summary.refresh();
    setNotice(`Invoice ${updated.reference} issued.`);
  }

  async function recordPayment(id, input) {
    const payload = await invoices.recordPayment(id, input);
    await summary.refresh();
    await payments.refresh();
    setNotice(
      payload.invoice.balance > 0
        ? `${formatMoney(payload.payment.amount)} recorded · ${formatMoney(payload.invoice.balance)} still owed on ${payload.invoice.reference}.`
        : `${formatMoney(payload.payment.amount)} recorded · ${payload.invoice.reference} settled.`,
    );
  }

  return (
    <div className="invoices-page">
      <MoneyStrip summary={summary.data} />

      {summary.error ? <p className="app-notice app-notice--error" role="alert">Money totals are unavailable: {summary.error}</p> : null}
      {notice ? <p className="form-notice" role="status">{notice}</p> : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Invoices</h2>
            <p className="panel__meta">
              {invoices.meta?.total ?? invoices.rows.length} {(invoices.meta?.total ?? invoices.rows.length) === 1 ? 'invoice' : 'invoices'} · managed by the manager desk
            </p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={() => { invoices.refresh(); summary.refresh(); }}>
            Refresh
          </button>
        </div>

        <div className="ledger-toolbar">
          <div className="ledger-toolbar__search">
            <input
              className="input"
              aria-label="Search invoices"
              placeholder="Invoice, customer or job reference…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="sp-chips" role="group" aria-label="Filter invoices">
            {INVOICE_FILTERS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                className={`sp-chip${filter === option.value ? ' is-active' : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {invoices.error ? <p className="app-notice app-notice--error" role="alert">{invoices.error}</p> : null}
        {invoices.status === 'loading' ? <p className="data-state" role="status">Loading invoices…</p> : null}

        {invoices.status !== 'loading' ? (
          <InvoiceTable
            invoices={invoices.rows.map((invoice) => ({ ...invoice }))}
            busyId={invoices.busyId}
            onIssue={issue}
            onPay={(invoice) => setPayingInvoice(invoice)}
            emptyMessage={filter || search
              ? 'No invoice matches this filter.'
              : 'No invoice exists yet. The manager drafts invoices from completed installations.'}
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Recent payments</h2>
            <p className="panel__meta">
              {payments.meta ? `${payments.meta.total} recorded · ${formatMoney(payments.meta.sum)} in view` : 'Every rupee received'}
            </p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={payments.refresh}>Refresh</button>
        </div>

        {payments.error ? <p className="app-notice app-notice--error" role="alert">{payments.error}</p> : null}
        {payments.status === 'loading' ? <p className="data-state" role="status">Loading payments…</p> : null}

        {payments.status !== 'loading' ? (
          <PaymentLedger
            payments={payments.rows}
            emptyMessage="Payments recorded by the manager appear here with their method and reference."
          />
        ) : null}
      </section>

      <p className="ledger-note">
        The admin can read the books and settle an invoice, but the manager owns drafting and issuing. Both screens read the
        same invoice and payment records, so a figure can never differ between them.
      </p>

      <PaymentDrawer
        invoice={payingInvoice}
        open={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        onSubmit={recordPayment}
      />
    </div>
  );
}
