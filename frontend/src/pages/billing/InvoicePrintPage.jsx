import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';
import { BUSINESS, BUSINESS_DETAILS_INCOMPLETE } from '../../content/business.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchInvoiceDetail } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import '../../styles/invoice-print.css';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function stampFor(invoice) {
  if (invoice.status === 'cancelled') return { label: 'Cancelled', tone: 'void' };
  if (invoice.status === 'draft') return { label: 'Draft – not issued', tone: 'draft' };
  if (invoice.paymentState === 'refund_due') return { label: 'Refund due', tone: 'partial' };
  if (invoice.paymentState === 'credited') return { label: 'Credited', tone: 'paid' };
  if (invoice.balance <= 0) return { label: 'Paid', tone: 'paid' };
  if (invoice.paidAmount > 0) return { label: 'Part paid', tone: 'partial' };
  return { label: 'Unpaid', tone: 'unpaid' };
}

/**
 * A4 invoice for printing or saving as PDF from the browser's print dialog.
 * It renders outside the app shell so the sidebar and topbar never print.
 */
export default function InvoicePrintPage() {
  const { invoiceId } = useParams();
  const [state, setState] = useState({ status: 'loading', invoice: null, payments: [], adjustments: [], error: null });

  useDocumentTitle(state.invoice ? `Invoice ${state.invoice.reference}` : 'Invoice');

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', invoice: null, payments: [], adjustments: [], error: null });

    fetchInvoiceDetail(invoiceId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', invoice: payload.data.invoice, payments: payload.data.payments, adjustments: payload.data.adjustments ?? [], error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', invoice: null, payments: [], adjustments: [], error: error.message });
      });

    return () => controller.abort();
  }, [invoiceId]);

  if (state.status === 'loading') return <p className="inv-state" role="status">Loading invoice…</p>;

  if (state.status === 'error') {
    return (
      <div className="inv-state" role="alert">
        <p>The invoice could not be opened: {state.error}</p>
        <button type="button" className="btn btn--outline" onClick={() => window.history.back()}>Go back</button>
      </div>
    );
  }

  const { invoice, payments, adjustments } = state;
  const stamp = stampFor(invoice);
  const vehicle = [invoice.vehicle?.label, invoice.vehicle?.registration].filter(Boolean).join(' · ');
  const description = [invoice.packageName ? `${invoice.packageName} package` : 'GPS tracking installation', vehicle].filter(Boolean);

  return (
    <div className="inv-shell">
      <div className="inv-toolbar">
        <button type="button" className="btn btn--outline btn--small" onClick={() => window.history.back()}>← Back</button>
        <div className="inv-toolbar__right">
          <span className="inv-toolbar__hint">Choose “Save as PDF” in the print window to download a PDF.</span>
          <button type="button" className="btn btn--primary btn--small" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {BUSINESS_DETAILS_INCOMPLETE ? (
        <p className="inv-warning">
          Shop address, phone and tax number are still placeholders. Update <code>frontend/src/content/business.js</code> before giving this invoice to a customer.
        </p>
      ) : null}

      <article className="inv-sheet" data-tone={stamp.tone}>
        <header className="inv-head">
          <div className="inv-brand">
            <img src={logoUrl} alt="" className="inv-logo" />
            <div>
              <strong className="inv-brand__name">{BUSINESS.legalName.startsWith('TODO') ? BUSINESS.name : BUSINESS.legalName}</strong>
              <span>{BUSINESS.address}</span>
              <span>{BUSINESS.phone} · {BUSINESS.email}</span>
              <span>Tax / registration no.: {BUSINESS.taxNumber}</span>
            </div>
          </div>
          <div className="inv-title">
            <h1>Invoice</h1>
            <p className="inv-ref">{invoice.reference}</p>
            <span className="inv-stamp" data-tone={stamp.tone}>{stamp.label}</span>
          </div>
        </header>

        <section className="inv-meta">
          <div>
            <h2>Billed to</h2>
            <p className="inv-strong">{invoice.customer?.name || 'Customer'}</p>
            {invoice.customer?.phone ? <p>{invoice.customer.phone}</p> : null}
          </div>
          <dl>
            <div><dt>Invoice date</dt><dd>{formatDay(invoice.issuedAt ?? invoice.createdAt)}</dd></div>
            <div><dt>Due date</dt><dd>{formatDay(invoice.dueDate)}</dd></div>
            {invoice.job?.reference ? <div><dt>Job reference</dt><dd>{invoice.job.reference}</dd></div> : null}
          </dl>
        </section>

        <table className="inv-lines">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="inv-num">Qty</th>
              <th scope="col" className="inv-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="inv-strong">{description[0]}</span>
                {description[1] ? <span className="inv-sub">{description[1]}</span> : null}
              </td>
              <td className="inv-num">1</td>
              <td className="inv-num">{formatMoney(invoice.amount, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>

        <section className="inv-totals">
          <dl>
            <div><dt>Total</dt><dd>{formatMoney(invoice.amount, invoice.currency)}</dd></div>
            {invoice.creditedAmount > 0 ? (
              <>
                <div><dt>Credit notes</dt><dd>−{formatMoney(invoice.creditedAmount, invoice.currency)}</dd></div>
                <div><dt>Net amount</dt><dd>{formatMoney(invoice.netAmount, invoice.currency)}</dd></div>
              </>
            ) : null}
            <div><dt>Received</dt><dd>{formatMoney(invoice.paidAmount, invoice.currency)}</dd></div>
            {invoice.refundedAmount > 0 ? <div><dt>Refunded</dt><dd>−{formatMoney(invoice.refundedAmount, invoice.currency)}</dd></div> : null}
            {invoice.refundable > 0 ? <div><dt>Owed back to customer</dt><dd>{formatMoney(invoice.refundable, invoice.currency)}</dd></div> : null}
            <div className="inv-totals__due"><dt>Balance due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
          </dl>
        </section>

        {payments.length > 0 ? (
          <section className="inv-payments">
            <h2>Payments received</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Method</th>
                  <th scope="col">Reference</th>
                  <th scope="col" className="inv-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDay(payment.receivedAt)}</td>
                    <td>{payment.methodLabel}</td>
                    <td>{payment.transactionRef || payment.reference}</td>
                    <td className="inv-num">{formatMoney(payment.amount, payment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {adjustments.length > 0 ? (
          <section className="inv-payments">
            <h2>Credit notes and refunds</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Document</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="inv-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDay(row.issuedAt)}</td>
                    <td>{row.kindLabel} {row.reference}</td>
                    <td>{row.reason}</td>
                    <td className="inv-num">{row.kind === 'credit_note' ? '−' : ''}{formatMoney(row.amount, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {invoice.notes ? <p className="inv-notes">{invoice.notes}</p> : null}

        <footer className="inv-foot">
          <p>{BUSINESS.warrantyNote}</p>
          <p>{BUSINESS.paymentNote}</p>
          <div className="inv-sign">
            <span>Customer signature</span>
            <span>Authorised signature</span>
          </div>
          <p className="inv-site">{BUSINESS.website}</p>
        </footer>
      </article>

      <p className="inv-back no-print"><Link to="/">Return to the app</Link></p>
    </div>
  );
}
