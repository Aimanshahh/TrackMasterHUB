import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';
import { BUSINESS, BUSINESS_DETAILS_INCOMPLETE } from '../../content/business.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchAdjustmentDetail } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import '../../styles/invoice-print.css';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

/** A4 credit note or refund receipt, printed from the browser like an invoice. */
export default function AdjustmentPrintPage() {
  const { adjustmentId } = useParams();
  const [state, setState] = useState({ status: 'loading', row: null, error: null });

  useDocumentTitle(state.row ? `${state.row.kindLabel} ${state.row.reference}` : 'Credit note');

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', row: null, error: null });
    fetchAdjustmentDetail(adjustmentId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', row: payload.data.adjustment ?? payload.data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', row: null, error: error.message });
      });
    return () => controller.abort();
  }, [adjustmentId]);

  if (state.status === 'loading') return <p className="inv-state" role="status">Loading document…</p>;
  if (state.status === 'error') {
    return (
      <div className="inv-state" role="alert">
        <p>The document could not be opened: {state.error}</p>
        <button type="button" className="btn btn--outline" onClick={() => window.history.back()}>Go back</button>
      </div>
    );
  }

  const { row } = state;
  const isRefund = row.kind === 'refund';

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
        <p className="inv-warning">Shop address, phone and tax number are still placeholders. Update <code>frontend/src/content/business.js</code> before giving this to a customer.</p>
      ) : null}

      <article className="inv-sheet" data-tone={isRefund ? 'paid' : 'partial'}>
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
            <h1>{isRefund ? 'Refund receipt' : 'Credit note'}</h1>
            <p className="inv-ref">{row.reference}</p>
          </div>
        </header>

        <section className="inv-meta">
          <div>
            <h2>{isRefund ? 'Refunded to' : 'Credited to'}</h2>
            <p className="inv-strong">{row.customer?.name || 'Customer'}</p>
          </div>
          <dl>
            <div><dt>Date</dt><dd>{formatDay(row.issuedAt)}</dd></div>
            <div><dt>Against invoice</dt><dd>{row.invoice?.reference}</dd></div>
            {isRefund && row.methodLabel ? <div><dt>Paid back by</dt><dd>{row.methodLabel}</dd></div> : null}
            {isRefund && row.transactionRef ? <div><dt>Reference</dt><dd>{row.transactionRef}</dd></div> : null}
          </dl>
        </section>

        <table className="inv-lines">
          <thead>
            <tr><th scope="col">Reason</th><th scope="col" className="inv-num">Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="inv-strong">{row.reason}</span></td>
              <td className="inv-num">{isRefund ? '' : '−'}{formatMoney(row.amount, row.currency)}</td>
            </tr>
          </tbody>
        </table>

        <footer className="inv-foot">
          <p>
            {isRefund
              ? 'This receipt confirms the amount above was paid back to the customer.'
              : 'This credit note reduces the amount due on the invoice named above. The original invoice is unchanged.'}
          </p>
          <div className="inv-sign">
            <span>Customer signature</span>
            <span>Authorised signature</span>
          </div>
        </footer>
      </article>

      <p className="inv-back no-print"><Link to="/">Return to the app</Link></p>
    </div>
  );
}
