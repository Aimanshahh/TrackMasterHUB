import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../../lib/format.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianJobs } from '../../hooks/useTechnician.js';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: '', label: 'All' },
];

const TEST_LABELS = [
  ['battery', 'Battery'],
  ['ignition', 'Ignition'],
  ['location', 'Location'],
  ['engineKill', 'Engine kill'],
];

function testTone(value) {
  if (value === 'verified') return 'ok';
  if (value === 'failed') return 'bad';
  if (value === 'requested') return 'warn';
  return 'plain';
}

export default function TechnicianJobsPage() {
  useDocumentTitle('Installations');
  const [filter, setFilter] = useState('open');
  const { rows, status, error, meta, refresh } = useTechnicianJobs({ status: filter, limit: 50 });

  return (
    <div className="tech-page">
      <div className="tech-filters" role="tablist" aria-label="Installation filter">
        {FILTERS.map((entry) => (
          <button
            key={entry.key || 'all'}
            type="button"
            role="tab"
            aria-selected={filter === entry.key}
            className={`tech-filter${filter === entry.key ? ' is-active' : ''}`}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
        <span className="tech-filters__count">{meta?.total ?? rows.length} record{(meta?.total ?? rows.length) === 1 ? '' : 's'}</span>
      </div>

      {status === 'loading' ? <p className="tech-state">Loading installations…</p> : null}
      {error ? (
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refresh}>Try again</button>
        </div>
      ) : null}

      {!error && status !== 'loading' && !rows.length ? (
        <div className="tech-empty">
          <p className="tech-empty__title">No installations here yet</p>
          <p>Operations assigns installations to you. As soon as one is assigned it appears in this list with the customer, vehicle and schedule.</p>
        </div>
      ) : null}

      {rows.length ? (
        <ul className="tech-jobs">
          {rows.map((job) => (
            <li key={job.id}>
              <Link className="tech-job tech-job--stacked" to={`/technician/installations/${job.id}`}>
                <div className="tech-job__topline">
                  <span className="tech-job__ref">{job.reference}</span>
                  <span className={`tech-pill tech-pill--${job.status === 'completed' ? 'ok' : job.submittedAt ? 'warn' : 'plain'}`}>
                    {job.reviewStatus === 'approved' ? 'Approved' : job.submittedAt ? 'Awaiting approval' : job.statusLabel}
                  </span>
                </div>
                <p className="tech-job__customer">{job.customerName}</p>
                <p className="tech-job__meta">
                  {job.vehicle?.label || 'Vehicle'} · {job.vehicle?.registration || 'no registration'}
                </p>
                <p className="tech-job__meta">
                  {job.scheduledAt ? formatDateTime(job.scheduledAt) : 'Not scheduled'} · {job.packageName || 'Package not set'}
                </p>
                <div className="tech-tests">
                  {TEST_LABELS.map(([key, label]) => (
                    <span key={key} className={`tech-test-dot tech-test-dot--${testTone(job.testing?.[key])}`}>
                      {label}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
