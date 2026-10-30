import { useState } from 'react';
import { Link } from 'react-router-dom';

import { JOB_STATUS_OPTIONS, formatDayTime, requestTypeLabel } from '../../app/operations.js';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useMyJobs } from '../../hooks/useSalesperson.js';
import { formatMoney } from '../../lib/format.js';

export default function SalespersonRequestsPage() {
  useDocumentTitle('Installation requests');
  const [status, setStatus] = useState('');
  const jobs = useMyJobs({ status });

  return (
    <div className="sp-requests">
      <section className="sp-toolbar sp-toolbar--tight">
        <div className="sp-chips" role="group" aria-label="Filter requests by status">
          <button type="button" className={`sp-chip${status === '' ? ' is-active' : ''}`} onClick={() => setStatus('')}>All</button>
          {JOB_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`sp-chip${status === option.value ? ' is-active' : ''}`}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="sp-text-btn" onClick={jobs.refresh}>{jobs.status === 'loading' ? 'Loading…' : 'Refresh'}</button>
      </section>

      {jobs.error ? <p className="app-notice app-notice--error" role="alert">{jobs.error}</p> : null}
      {jobs.status === 'loading' ? <p className="data-state" role="status">Loading your requests…</p> : null}

      {jobs.status !== 'loading' && !jobs.error && jobs.rows.length === 0 ? (
        <div className="app-empty sp-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{status ? 'Nothing with this status' : 'No requests pushed yet'}</h2>
          <p>
            {status
              ? 'Choose another status or open all requests.'
              : 'A request appears the moment you add a customer with the new installation option.'}
          </p>
          {status ? <button type="button" className="btn btn--outline btn--small" onClick={() => setStatus('')}>Show all</button> : null}
        </div>
      ) : null}

      {jobs.rows.length > 0 ? (
        <ul className="sp-jobcards">
          {jobs.rows.map((job) => {
            const latest = job.history?.[job.history.length - 1];
            return (
              <li key={job.id} className="sp-jobcard">
                <header className="sp-jobcard__head">
                  <div>
                    <span className="sp-ref">{job.reference}</span>
                    <h3>{job.customerName || 'Customer'}</h3>
                  </div>
                  <StatusPill status={job.status} label={job.statusLabel} />
                </header>

                <dl className="sp-jobcard__facts">
                  <div><dt>Request</dt><dd>{requestTypeLabel(job.requestType)}</dd></div>
                  <div><dt>Vehicle</dt><dd>{[job.vehicle.label, job.vehicle.registration].filter(Boolean).join(' · ') || '—'}</dd></div>
                  <div><dt>Station</dt><dd>{job.vehicle.station || '—'}</dd></div>
                  <div><dt>Technician</dt><dd>{job.technician?.name || 'Not assigned'}</dd></div>
                  <div><dt>Package</dt><dd>{job.packageName || 'Not recorded'}</dd></div>
                  <div><dt>Quoted</dt><dd>{job.quotedPrice === null || job.quotedPrice === undefined ? '—' : formatMoney(job.quotedPrice)}</dd></div>
                  <div><dt>Device IMEI</dt><dd>{job.deviceImei || 'Not recorded'}</dd></div>
                  <div><dt>SIM</dt><dd>{job.simNumber || 'Not recorded'}</dd></div>
                  <div><dt>Scheduled</dt><dd>{job.scheduledAt ? formatDayTime(job.scheduledAt) : 'Not scheduled'}</dd></div>
                  <div><dt>Pushed</dt><dd>{formatDayTime(job.createdAt)}</dd></div>
                </dl>

                {latest ? (
                  <p className="sp-jobcard__latest">
                    <span>Latest update</span>
                    {latest.statusLabel} · {latest.note || 'Status changed'} · {formatDayTime(latest.at)}
                  </p>
                ) : null}

                {job.approvalStatus === 'pending' ? (
                  <p className="sp-approval" data-state="pending">
                    Price waiting for admin approval · quoted {formatMoney(job.quotedPrice)} against the {formatMoney(job.listPrice)} package rate.
                  </p>
                ) : null}
                {job.approvalStatus === 'rejected' ? (
                  <p className="sp-approval" data-state="rejected">
                    The admin rejected this price. Requote before the installation can go ahead.
                  </p>
                ) : null}

                <footer className="sp-jobcard__foot">
                  <Link to={`/salesperson/customers/${job.customer}`} className="sp-open">Open customer record</Link>
                  <span className="sp-block__meta">{job.priority} priority</span>
                </footer>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
