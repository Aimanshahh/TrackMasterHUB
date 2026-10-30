import { useState } from 'react';

import { formatDayTime } from '../../app/operations.js';
import { useApprovals } from '../../hooks/useApprovals.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatMoney } from '../../lib/format.js';

const TABS = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

function DecisionForm({ approval, busy, onDecide }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  async function decide(decision) {
    setError(null);
    try {
      await onDecide(approval.id, decision, note);
    } catch (decisionError) {
      setError(decisionError.message || 'The decision was not recorded.');
    }
  }

  return (
    <div className="approval__decision">
      <label className="field">
        <span className="field__label">Reason for the customer</span>
        <input
          className="input"
          maxLength={500}
          placeholder={approval.status === 'pending' ? 'Why is this price acceptable, or why not?' : ''}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <div className="approval__actions">
        <button
          type="button"
          className="btn btn--primary btn--small"
          disabled={busy}
          onClick={() => decide('approved')}
        >
          {busy ? 'Recording…' : 'Approve price'}
        </button>
        <button
          type="button"
          className="btn btn--outline btn--small"
          disabled={busy}
          onClick={() => decide('rejected')}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function ApprovalCard({ approval, busyId, onDecide }) {
  const pending = approval.status === 'pending';
  const discountPercent = approval.listPrice > 0
    ? Math.round(((approval.listPrice - approval.quotedPrice) / approval.listPrice) * 100)
    : 0;

  return (
    <li className={`approval approval--${approval.status}`}>
      <header className="approval__head">
        <div>
          <p className="approval__ref">{approval.reference} · {formatDayTime(approval.createdAt)}</p>
          <h3>{approval.customer?.name || 'Customer'}</h3>
          <p className="approval__meta">
            {[approval.job?.vehicle?.label, approval.job?.vehicle?.registration, approval.job?.vehicle?.station]
              .filter(Boolean)
              .join(' · ') || 'No vehicle details recorded'}
          </p>
        </div>
        <span className="approval__state" data-state={approval.status}>
          {pending ? 'Waiting on you' : approval.status === 'approved' ? 'Approved' : 'Rejected'}
        </span>
      </header>

      <dl className="approval__math">
        <div>
          <dt>{approval.packageName} package rate</dt>
          <dd className="approval__list">{formatMoney(approval.listPrice)}</dd>
        </div>
        <div>
          <dt>Quoted to customer</dt>
          <dd className="approval__quote">{formatMoney(approval.quotedPrice)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{formatMoney(approval.discount)}{discountPercent > 0 ? ` · ${discountPercent}%` : ''}</dd>
        </div>
      </dl>

      {approval.reason ? <p className="approval__reason"><span>Salesperson’s note</span>{approval.reason}</p> : null}

      <footer className="approval__foot">
        <p className="approval__origin">
          Requested by {approval.requestedBy?.name || 'a salesperson'}
          {approval.job?.reference ? ` · job ${approval.job.reference}` : ''}
        </p>
        {pending ? (
          <DecisionForm approval={approval} busy={busyId === approval.id} onDecide={onDecide} />
        ) : (
          <p className="approval__decision-note">
            {approval.decidedBy?.name ? `Decided by ${approval.decidedBy.name}` : 'Decision recorded'}
            {approval.decidedAt ? ` on ${formatDayTime(approval.decidedAt)}` : ''}
            {approval.decisionNote ? ` — ${approval.decisionNote}` : ''}
          </p>
        )}
      </footer>
    </li>
  );
}

export default function ApprovalsPage() {
  useDocumentTitle('Price approvals');
  const [status, setStatus] = useState('pending');
  const approvals = useApprovals({ status });

  return (
    <div className="approvals-page">
      <section className="approvals-lede">
        <div>
          <p className="app-page-head__eyebrow">PRICE APPROVALS</p>
          <h2>Discounts that need a decision.</h2>
          <p>
            Every request here is an installation quoted below the package rate. Approving it lets
            operations complete the job; rejecting it sends the job back to the salesperson to requote.
          </p>
        </div>
        {approvals.meta?.pending ? (
          <p className="approvals-count">
            <strong>{approvals.meta.pending}</strong>
            <span>waiting for a decision</span>
          </p>
        ) : null}
      </section>

      <div className="approvals-bar">
        <div className="sp-chips" role="group" aria-label="Filter approvals by status">
          {TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              className={`sp-chip${status === tab.value ? ' is-active' : ''}`}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="sp-text-btn" onClick={approvals.refresh}>
          {approvals.status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {approvals.error ? <p className="app-notice app-notice--error" role="alert">{approvals.error}</p> : null}
      {approvals.status === 'loading' ? <p className="data-state" role="status">Loading approvals…</p> : null}

      {approvals.status !== 'loading' && approvals.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{status === 'pending' ? 'Nothing waiting on you' : 'No approvals in this view'}</h2>
          <p>
            {status === 'pending'
              ? 'A request appears here the moment a salesperson quotes below a package rate.'
              : 'Choose another tab to see the other decisions.'}
          </p>
        </div>
      ) : null}

      {approvals.rows.length > 0 ? (
        <ul className="approval-list">
          {approvals.rows.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              busyId={approvals.busyId}
              onDecide={approvals.decide}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
