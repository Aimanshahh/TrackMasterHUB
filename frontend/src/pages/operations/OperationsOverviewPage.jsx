import { Link } from 'react-router-dom';

import { formatDayTime } from '../../app/operations.js';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useComplaints, useJobs, useOperationsSummary, useTechnicianStock } from '../../hooks/useOperations.js';

/**
 * A short morning view for the operations desk: four numbers that each open
 * the right screen, then one list of what needs doing now.
 */
export default function OperationsOverviewPage() {
  useDocumentTitle('Operations overview');
  const summary = useOperationsSummary();
  const waiting = useJobs({ status: 'unassigned', limit: 5 });
  const complaints = useComplaints({ status: 'open', limit: 5 });
  const stock = useTechnicianStock();

  const jobs = summary.data?.jobs;
  const inProgress = jobs ? (jobs.assigned ?? 0) + (jobs.scheduled ?? 0) + (jobs.in_progress ?? 0) : null;
  const lowTechnicians = stock.rows.filter((row) => row.low);

  const tiles = [
    { label: 'Waiting for a technician', value: jobs?.unassigned ?? null, to: '/operations/queue', tone: (jobs?.unassigned ?? 0) > 0 ? 'attention' : '' },
    { label: 'Being worked on', value: inProgress, to: '/operations/queue', tone: '' },
    { label: 'Open complaints', value: complaints.meta?.total ?? null, to: '/operations/complaints', tone: (complaints.meta?.total ?? 0) > 0 ? 'attention' : '' },
    { label: 'Technicians low on devices', value: stock.status === 'loading' ? null : lowTechnicians.length, to: '/operations/inventory', tone: lowTechnicians.length > 0 ? 'attention' : '' },
  ];

  const nothingToDo = waiting.status !== 'loading' && complaints.status !== 'loading' && stock.status !== 'loading'
    && waiting.rows.length === 0 && complaints.rows.length === 0 && lowTechnicians.length === 0;

  return (
    <div className="ops-home">
      {summary.error ? <p className="app-notice app-notice--error" role="alert">The numbers could not be loaded: {summary.error}</p> : null}

      <section className="ops-home__tiles" aria-label="Today at a glance">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="ops-home__tile" data-tone={tile.tone}>
            <span>{tile.label}</span>
            <strong>{tile.value === null || tile.value === undefined ? '—' : tile.value}</strong>
          </Link>
        ))}
      </section>

      <div className="ops-home__actions">
        <Link className="btn btn--outline btn--small" to="/operations/customers">Find a customer</Link>
        <Link className="btn btn--outline btn--small" to="/operations/whatsapp">Send a WhatsApp</Link>
        <Link className="btn btn--outline btn--small" to="/operations/inventory">Fetch devices from Shezz</Link>
        <button type="button" className="btn btn--outline btn--small" onClick={() => { summary.refresh(); waiting.refresh(); complaints.refresh(); stock.refresh(); }}>Refresh</button>
      </div>

      <section className="wa-card">
        <header className="wa-card__head"><h2>Needs your attention</h2></header>

        {nothingToDo ? <p className="panel__note">Nothing is waiting. Every task has a technician, no complaint is open and everyone has devices.</p> : null}

        {waiting.rows.length > 0 ? (
          <div className="ops-home__group">
            <h3>Tasks with no technician <Link to="/operations/queue">See all →</Link></h3>
            <ul className="ops-home__list">
              {waiting.rows.map((job) => (
                <li key={job.id}>
                  <div>
                    <strong>{job.customerName || 'Customer'}</strong>
                    <span>{[job.vehicle?.registration, job.vehicle?.station].filter(Boolean).join(' · ') || job.phone || 'No vehicle details'}</span>
                  </div>
                  <time>{formatDayTime(job.createdAt)}</time>
                  <StatusPill status={job.status} label={job.statusLabel} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {complaints.rows.length > 0 ? (
          <div className="ops-home__group">
            <h3>Open complaints <Link to="/operations/complaints">See all →</Link></h3>
            <ul className="ops-home__list">
              {complaints.rows.map((complaint) => (
                <li key={complaint.id}>
                  <div>
                    <strong>{complaint.title}</strong>
                    <span>{[complaint.customerName, complaint.reference].filter(Boolean).join(' · ')}</span>
                  </div>
                  <time>{formatDayTime(complaint.createdAt)}</time>
                  <StatusPill status={complaint.status} label={complaint.statusLabel} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lowTechnicians.length > 0 ? (
          <div className="ops-home__group">
            <h3>Technicians who need more devices <Link to="/operations/inventory">Open inventory →</Link></h3>
            <ul className="ops-home__list">
              {lowTechnicians.map((row) => (
                <li key={row.technicianId}>
                  <div>
                    <strong>{row.name}</strong>
                    <span>{row.station || 'No station'}</span>
                  </div>
                  <span className="ops-low">{row.devices.held} left</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
