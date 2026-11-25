import { Link } from 'react-router-dom';

import { formatDateTime } from '../../lib/format.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/auth.js';
import { useTechnicianSummary } from '../../hooks/useTechnician.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatusPill({ job }) {
  const state = job.reviewStatus === 'pending' && job.submittedAt ? 'Awaiting approval' : job.statusLabel;
  const tone = job.reviewStatus === 'approved' ? 'ok' : job.submittedAt ? 'warn' : 'plain';
  return <span className={`tech-pill tech-pill--${tone}`}>{state}</span>;
}

export default function TechnicianOverviewPage() {
  useDocumentTitle('Today');
  const { user } = useAuth();
  const { data, status, error, refresh } = useTechnicianSummary();

  const firstName = (user?.name ?? '').split(' ')[0];
  const counts = data?.counts;
  const today = data?.today ?? [];
  const next = data?.next ?? [];

  return (
    <div className="tech-page">
      <header className="tech-hero">
        <p className="tech-hero__date">
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
        <h1>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="tech-hero__line">
          {today.length
            ? `${today.length} installation${today.length === 1 ? '' : 's'} scheduled for today.`
            : 'Nothing scheduled for today. Your next jobs are listed below.'}
        </p>
        {data?.technician?.station ? (
          <p className="tech-hero__station"><span aria-hidden="true">•</span> Station: {data.technician.station}</p>
        ) : null}
      </header>

      {status === 'loading' ? <p className="tech-state">Loading your day…</p> : null}
      {error ? (
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refresh}>Try again</button>
        </div>
      ) : null}

      {counts ? (
        <div className="tech-metrics">
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.openInstallations}</span>
            <span className="tech-metric__label">Open installations</span>
          </div>
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.awaitingReview}</span>
            <span className="tech-metric__label">Awaiting approval</span>
          </div>
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.devicesInStock}</span>
            <span className="tech-metric__label">Devices in stock</span>
          </div>
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.simsInStock}</span>
            <span className="tech-metric__label">SIMs in stock</span>
          </div>
        </div>
      ) : null}

      <section className="tech-section">
        <div className="tech-section__head">
          <h2>Today</h2>
          <Link className="tech-link" to="/technician/installations">All installations</Link>
        </div>

        {today.length ? (
          <ul className="tech-jobs">
            {today.map((job) => (
              <li key={job.id}>
                <Link className="tech-job" to={`/technician/installations/${job.id}`}>
                  <div className="tech-job__when">
                    <strong>{job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Unscheduled'}</strong>
                    <span>{job.vehicle?.station || job.vehicle?.label || 'Station not set'}</span>
                  </div>
                  <div className="tech-job__body">
                    <p className="tech-job__customer">{job.customerName}</p>
                    <p className="tech-job__meta">
                      {job.vehicle?.registration || 'No registration'} · {job.packageName || 'Package not set'}
                    </p>
                    <StatusPill job={job} />
                  </div>
                  <span className="tech-job__go" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tech-empty">
            <p className="tech-empty__title">No installation scheduled for today</p>
            <p>When operations books a vehicle for you it appears here with its time, address and testing checklist.</p>
          </div>
        )}
      </section>

      {next.length ? (
        <section className="tech-section">
          <div className="tech-section__head"><h2>Coming up</h2></div>
          <ul className="tech-upcoming">
            {next.map((job) => (
              <li key={job.id}>
                <Link to={`/technician/installations/${job.id}`}>
                  <span className="tech-upcoming__date">
                    {job.scheduledAt ? formatDateTime(job.scheduledAt) : 'Not scheduled'}
                  </span>
                  <span className="tech-upcoming__name">{job.customerName}</span>
                  <span className="tech-upcoming__reg">{job.vehicle?.registration || '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
