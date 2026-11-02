import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PriorityTag, StatusPill } from '../../components/operations/OpsStatus.jsx';
import { daysSince, formatDayTime, waitingLabel } from '../../app/operations.js';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { usePendingInstallations } from '../../hooks/usePendingInstallations.js';
import { formatMoney } from '../../lib/format.js';

const STAGES = [
  { value: '', label: 'All pending', count: 'all' },
  { value: 'unassigned', label: 'Unassigned', count: 'unassigned' },
  { value: 'assigned', label: 'Assigned', count: 'assigned' },
  { value: 'scheduled', label: 'Scheduled', count: 'scheduled' },
  { value: 'in_progress', label: 'In progress', count: 'in_progress' },
  { value: 'approval', label: 'Awaiting price approval', count: 'awaitingApproval' },
];

/**
 * Every sold vehicle that is not installed yet, oldest first. Shared by the
 * Admin and Operations workspaces; both may open the same operations queue.
 */
export default function PendingInstallationsPage() {
  useDocumentTitle('Pending installations');
  const { user } = useAuth();
  const queuePath = user?.role === 'admin' ? '/admin/operations' : '/operations/queue';
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const pending = usePendingInstallations({ q: search, stage });
  const counts = pending.meta?.counts ?? {};

  return (
    <div className="pending-page">
      <div className="lookup-bar">
        <div className="lookup-bar__field">
          <span className="lookup-bar__label">Find a pending installation</span>
          <input
            className="input"
            aria-label="Search pending installations"
            placeholder="Customer, phone, registration, job reference…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="lookup-bar__count">
          {counts.all ?? pending.rows.length} waiting
        </span>
      </div>

      <div className="sp-chips" role="group" aria-label="Filter by stage">
        {STAGES.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            className={`sp-chip${stage === option.value ? ' is-active' : ''}`}
            onClick={() => setStage(option.value)}
          >
            {option.label}{counts[option.count] !== undefined ? ` · ${counts[option.count]}` : ''}
          </button>
        ))}
      </div>

      {pending.error ? <p className="app-notice app-notice--error" role="alert">Pending installations are unavailable: {pending.error}</p> : null}
      {pending.status === 'loading' ? <p className="data-state" role="status">Loading pending installations…</p> : null}

      {pending.status !== 'loading' && !pending.error && pending.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{search || stage ? 'Nothing matches this filter' : 'No pending installations'}</h2>
          <p>{search || stage ? 'Clear the search or choose another stage.' : 'Every sold vehicle has been installed.'}</p>
        </div>
      ) : null}

      {pending.rows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Waiting</th>
                <th scope="col">Customer</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Package</th>
                <th scope="col">Technician</th>
                <th scope="col">Slot</th>
                <th scope="col">Stage</th>
                <th scope="col" className="ledger__action-col"><span className="ledger__sr">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {pending.rows.map((job) => {
                const days = daysSince(job.createdAt);
                return (
                  <tr key={job.id}>
                    <td>
                      <span className="ledger__strong" data-late={days >= 3}>{waitingLabel(days)}</span>
                      <span className="ledger__sub">{job.reference}</span>
                    </td>
                    <td>
                      <span className="ledger__strong">{job.customerName || 'Customer'}</span>
                      <span className="ledger__sub">{job.phone || 'No phone'}</span>
                    </td>
                    <td>
                      <span className="ledger__strong">{job.vehicle?.label || '—'}</span>
                      <span className="ledger__sub">{[job.vehicle?.registration, job.vehicle?.station].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>
                      <span className="ledger__strong">{job.packageName || '—'}</span>
                      <span className="ledger__sub">
                        {job.quotedPrice !== null ? formatMoney(job.quotedPrice) : ''}
                        {job.approvalStatus === 'pending' ? ' · awaiting approval' : ''}
                        {job.approvalStatus === 'rejected' ? ' · price rejected' : ''}
                      </span>
                    </td>
                    <td>
                      <span className="ledger__muted">{job.technician?.name || 'Not assigned'}</span>
                    </td>
                    <td className="ledger__muted">{job.scheduledAt ? formatDayTime(job.scheduledAt) : 'Not set'}</td>
                    <td>
                      <StatusPill status={job.status} label={job.statusLabel} />
                      {job.priority === 'high' || job.priority === 'urgent' ? <PriorityTag priority={job.priority} /> : null}
                    </td>
                    <td className="ledger__action-col">
                      <Link className="ledger__open" to={queuePath}>Open queue</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ledger-note">
        Oldest first. A vehicle leaves this list once operations marks the installation completed or cancelled.
      </p>
    </div>
  );
}
