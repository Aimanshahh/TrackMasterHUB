import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';
import { BUSINESS, BUSINESS_DETAILS_INCOMPLETE } from '../../content/business.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchQuotation } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import '../../styles/invoice-print.css';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

const STAMP_TONES = {
  draft: { label: 'Draft — not sent', tone: 'draft' },
  sent: { label: 'Awaiting answer', tone: 'partial' },
  accepted: { label: 'Accepted', tone: 'paid' },
  rejected: { label: 'Not accepted', tone: 'unpaid' },
  expired: { label: 'Expired', tone: 'void' },
};

/**
 * A4 quotation for printing or saving as PDF. A quotation is a promise about a
 * price, not a bill, so it carries its validity date and the terms in full and
 * never shows a balance due.
 */
export default function QuotationPrintPage() {
  const { quotationId } = useParams();
  const [state, setState] = useState({ status: 'loading', quotation: null, error: null });

  useDocumentTitle(state.quotation ? `Quotation ${state.quotation.reference}` : 'Quotation');

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', quotation: null, error: null });

    fetchQuotation(quotationId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', quotation: payload.data.quotation, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', quotation: null, error: error.message });
      });

    return () => controller.abort();
  }, [quotationId]);

  if (state.status === 'loading') return <p className="inv-state" role="status">Loading quotation…</p>;

  if (state.status === 'error') {
    return (
      <div className="inv-state" role="alert">
        <p>The quotation could not be opened: {state.error}</p>
        <button type="button" className="btn btn--outline" onClick={() => window.history.back()}>Go back</button>
      </div>
    );
  }

  const { quotation } = state;
  const stamp = STAMP_TONES[quotation.effectiveStatus] ?? STAMP_TONES.draft;
  const vehicle = [quotation.vehicle?.label, quotation.vehicle?.registration].filter(Boolean).join(' · ');
  const terms = quotation.terms ? quotation.terms.split('\n').filter(Boolean) : [];

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
          Shop address, phone and tax number are still placeholders. Update <code>frontend/src/content/business.js</code> before giving this quotation to a customer.
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
            <h1>Quotation</h1>
            <p className="inv-ref">{quotation.reference}</p>
            <span className="inv-stamp" data-tone={stamp.tone}>{stamp.label}</span>
          </div>
        </header>

        <section className="inv-meta">
          <div>
            <h2>Prepared for</h2>
            <p className="inv-strong">{quotation.customer?.name || 'Customer'}</p>
            {quotation.customer?.phone ? <p>{quotation.customer.phone}</p> : null}
            {vehicle ? <p className="inv-sub">Vehicle {vehicle}</p> : null}
          </div>
          <dl>
            <div><dt>Prepared on</dt><dd>{formatDay(quotation.createdAt)}</dd></div>
            <div><dt>Valid until</dt><dd>{formatDay(quotation.validUntil)}</dd></div>
            {quotation.createdBy?.name ? <div><dt>Prepared by</dt><dd>{quotation.createdBy.name}</dd></div> : null}
            {quotation.version > 1 ? <div><dt>Version</dt><dd>{quotation.version}</dd></div> : null}
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
                <span className="inv-strong">{quotation.packageName} package</span>
                <span className="inv-sub">
                  {[quotation.packageSummary, vehicle].filter(Boolean).join(' · ') || 'GPS tracking installation'}
                </span>
              </td>
              <td className="inv-num">1</td>
              <td className="inv-num">{formatMoney(quotation.amount, quotation.currency)}</td>
            </tr>
          </tbody>
        </table>

        <section className="inv-totals">
          <dl>
            {quotation.listPrice !== null ? (
              <div><dt>Package rate</dt><dd>{formatMoney(quotation.listPrice, quotation.currency)}</dd></div>
            ) : null}
            {quotation.discount > 0 ? (
              <div><dt>Agreed reduction</dt><dd>−{formatMoney(quotation.discount, quotation.currency)}</dd></div>
            ) : null}
            <div className="inv-totals__due"><dt>Quoted total</dt><dd>{formatMoney(quotation.amount, quotation.currency)}</dd></div>
          </dl>
        </section>

        {terms.length > 0 ? (
          <section className="inv-terms">
            <h2>Terms</h2>
            <ol>
              {terms.map((line) => <li key={line}>{line}</li>)}
            </ol>
          </section>
        ) : null}

        <footer className="inv-foot">
          <p>{BUSINESS.warrantyNote}</p>
          <p>This is a quotation, not a tax invoice. The price holds until the validity date shown above.</p>
          <div className="inv-sign">
            <span>Customer acceptance</span>
            <span>For {BUSINESS.name}</span>
          </div>
          <p className="inv-site">{BUSINESS.website}</p>
        </footer>
      </article>

      <p className="inv-back no-print"><Link to="/">Return to the app</Link></p>
    </div>
  );
}
