import { useState } from 'react';
import { Link } from 'react-router-dom';

import MoneyStrip from '../../components/billing/MoneyStrip.jsx';
import { useBillingQueue, useBillingSummary } from '../../hooks/useBilling.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useManagerSummary } from '../../hooks/useManager.js';
import { formatMoney } from '../../lib/format.js';

function QueueRow({ job, busy, onDraft }) {
  return (
    <li className="queue-row">
      <div className="queue-row__main">
        <span className="queue-row__ref">{job.reference}</span>
        <strong>{job.customerName || job.customer?.name || 'Customer'}</strong>
        <span className="queue-row__meta">
          {[job.vehicle?.label, job.vehicle?.registration, job.vehicle?.station].filter(Boolean).join(' · ') || 'No vehicle recorded'}
        </span>
      </div>
      <div className="queue-row__money">
        <span>{formatMoney(job.quotedPrice ?? job.listPrice)}</span>
        <small>{job.packageName || 'No package'}</small>
      </div>
      <button type="button" className="btn btn--outline btn--small" disabled={busy} onClick={() => onDraft(job)}>
        {busy ? 'Drafting…' : 'Draft invoice'}
      </button>
    </li>
  );
}

export default function ManagerOverviewPage() {
  useDocumentTitle('Manager overview');
  const manager = useManagerSummary();
  const billing = useBillingSummary();
  const queue = useBillingQueue();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const summary = manager.data;

  async function draftInvoice(job) {
    setBusyId(job.id);
    setError(null);
    setNotice(null);
    try {
      const invoice = await queue.draft(job.id);
      await billing.refresh();
      setNotice(`Invoice ${invoice.reference} drafted for ${formatMoney(invoice.amount)}. Issue it from the invoices screen.`);
    } catch (error_) {
      setError(error_.message || 'The invoice could not be drafted.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mgr-overview">
      {manager.error ? <p className="app-notice app-notice--error" role="alert">The manager summary is unavailable: {manager.error}</p> : null}
      {billing.error ? <p className="app-notice app-notice--error" role="alert">Money totals are unavailable: {billing.error}</p> : null}

      <MoneyStrip summary={billing.data} />

      <div className="mgr-overview__cols">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Finished installations waiting for an invoice</h2>
              <p className="panel__meta">Completed by operations, still unbilled.</p>
            </div>
            <Link to="/manager/invoices" className="btn btn--outline btn--small">All invoices</Link>
          </div>

          {notice ? <p className="form-notice" role="status">{notice}</p> : null}
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          {queue.error ? <p className="app-notice app-notice--error" role="alert">{queue.error}</p> : null}
          {queue.status === 'loading' ? <p className="data-state" role="status">Loading the billing queue…</p> : null}

          {queue.status !== 'loading' && queue.rows.length === 0 ? (
            <div className="app-empty">
              <span className="app-empty__mark" aria-hidden="true">—</span>
              <h2>Nothing waiting to be billed</h2>
              <p>When operations completes an installation, it appears here with the price it was sold at.</p>
            </div>
          ) : null}

          {queue.rows.length > 0 ? (
            <ul className="queue-list">
              {queue.rows.map((job) => (
                <QueueRow key={job.id} job={job} busy={busyId === job.id} onDraft={draftInvoice} />
              ))}
            </ul>
          ) : null}
        </section>

        <aside className="panel desk-panel">
          <div className="panel__head">
            <h2 className="panel__title">Waiting on you</h2>
            <button type="button" className="btn btn--outline btn--small" onClick={() => { manager.refresh(); billing.refresh(); queue.refresh(); }}>
              Refresh
            </button>
          </div>

          <ul className="desk-list">
            <li>
              <Link to="/manager/customers">
                <span>Security briefings to complete</span>
                <strong>{summary?.customers?.briefingPending ?? '—'}</strong>
              </Link>
            </li>
            <li>
              <Link to="/manager/invoices">
                <span>Invoices to draft or issue</span>
                <strong>{summary?.invoices?.toDraft ?? '—'}</strong>
              </Link>
            </li>
            <li>
              <Link to="/manager/invoices">
                <span>Issued invoices past due</span>
                <strong>{summary?.invoices?.overdue ?? '—'}</strong>
              </Link>
            </li>
            <li>
              <Link to="/manager/complaints">
                <span>Open complaints</span>
                <strong>{summary?.complaints?.open ?? '—'}</strong>
              </Link>
            </li>
          </ul>

          <div className="desk-panel__foot">
            <div><span>Installations in flight</span><strong>{summary?.installations?.inFlight ?? '—'}</strong></div>
            <div><span>Activated accounts</span><strong>{summary?.customers?.briefingDone ?? '—'}</strong></div>
          </div>
        </aside>
      </div>

      <section className="panel pipeline-panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">How a customer becomes active</h2>
            <p className="panel__meta">Each step is recorded by the role that performs it — nothing is inferred.</p>
          </div>
        </div>
        <ol className="pipeline">
          <li><span>01</span><strong>Salesperson</strong><p>Creates the customer and pushes the installation with its package and quoted price.</p></li>
          <li><span>02</span><strong>Operations</strong><p>Assigns technician, device IMEI and SIM, then completes the installation.</p></li>
          <li><span>03</span><strong>Manager</strong><p>Records the security briefing here. This is the activation gate.</p></li>
          <li><span>04</span><strong>Billing</strong><p>Draft the invoice, issue it, then record each payment — in full or in part.</p></li>
        </ol>
      </section>
    </div>
  );
}
