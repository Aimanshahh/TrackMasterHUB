import { useState } from 'react';

import InvoiceTable from '../../components/billing/InvoiceTable.jsx';
import MoneyStrip from '../../components/billing/MoneyStrip.jsx';
import PaymentDrawer from '../../components/billing/PaymentDrawer.jsx';
import { INVOICE_FILTERS } from '../../app/billing.js';
import { useBillingSummary, useInvoices } from '../../hooks/useBilling.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatMoney } from '../../lib/format.js';

export default function ManagerInvoicesPage() {
  useDocumentTitle('Invoices');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [notice, setNotice] = useState(null);

  const status = filter === 'draft' ? 'draft' : '';
  const paymentState = ['unpaid', 'partial', 'paid'].includes(filter) ? filter : '';
  const invoices = useInvoices({ q: search, status, paymentState });
  const summary = useBillingSummary();

  async function issue(invoice) {
    setNotice(null);
    const updated = await invoices.issue(invoice.id);
    await summary.refresh();
    setNotice(`Invoice ${updated.reference} issued${updated.dueDate ? `, due ${new Date(updated.dueDate).toLocaleDateString('en-GB')}` : ''}.`);
  }

  async function recordPayment(id, input) {
    const payload = await invoices.recordPayment(id, input);
    await summary.refresh();
    setNotice(
      payload.invoice.balance > 0
        ? `${formatMoney(payload.payment.amount)} recorded. ${formatMoney(payload.invoice.balance)} remains on ${payload.invoice.reference}.`
        : `${formatMoney(payload.payment.amount)} recorded. ${payload.invoice.reference} is settled.`,
    );
  }

  return (
    <div className="invoices-page">
      <MoneyStrip summary={summary.data} />

      {summary.error ? <p className="app-notice app-notice--error" role="alert">Money totals are unavailable: {summary.error}</p> : null}
      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      {invoices.error ? <p className="app-notice app-notice--error" role="alert">Invoices could not be loaded: {invoices.error}</p> : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Invoice register</h2>
            <p className="panel__meta">
              {invoices.meta?.total ?? invoices.rows.length} {(invoices.meta?.total ?? invoices.rows.length) === 1 ? 'invoice' : 'invoices'}
              {invoices.meta?.draftCount ? ` · ${invoices.meta.draftCount} not issued` : ''}
            </p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={invoices.refresh}>
            {invoices.status === 'loading' ? 'Loading…' : 'Refresh'}
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

        {invoices.status === 'loading' ? <p className="data-state" role="status">Loading invoices…</p> : null}

        {invoices.status !== 'loading' ? (
          <InvoiceTable
            invoices={invoices.rows}
            busyId={invoices.busyId}
            onIssue={issue}
            onPay={(invoice) => setPayingInvoice(invoice)}
            emptyMessage={
              filter || search
                ? 'No invoice matches this filter. Clear it to see the rest of the register.'
                : 'Invoices are drafted from completed installations on the overview screen.'
            }
          />
        ) : null}
      </section>

      <p className="ledger-note">
        An invoice is issued once and settled by the payments recorded against it. A customer paying half now and half later
        leaves two payment entries on the same invoice; the invoice amount itself never changes.
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
