import { Link } from 'react-router-dom';

import { JOB_STATUS_OPTIONS, formatDayTime } from '../../app/operations.js';
import Panel from '../../components/app/Panel.jsx';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import StationStockPanel from '../../components/operations/StationStockPanel.jsx';
import TechnicianStockPanel from '../../components/operations/TechnicianStockPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useJobs, useOperationsSummary } from '../../hooks/useOperations.js';

const OPEN_STATUSES = ['unassigned', 'assigned', 'scheduled', 'in_progress'];

export default function OperationsOverviewPage() {
  useDocumentTitle('Operations overview');
  const summary = useOperationsSummary();
  const recent = useJobs({ limit: 6 });
  const jobs = summary.data?.jobs;
  const inventory = summary.data?.inventory;
  const technicians = summary.data?.technicians;

  const openJobs = jobs ? OPEN_STATUSES.reduce((total, status) => total + (jobs[status] ?? 0), 0) : null;

  const metrics = [
    ['Open jobs', openJobs, 'queued, assigned or in progress'],
    ['Completed', jobs?.completed ?? null, 'installations closed out'],
    ['Devices available', inventory?.devices?.in_stock ?? null, 'unallocated IMEI stock'],
    ['SIMs available', inventory?.sims?.in_stock ?? null, 'unallocated SIM stock'],
  ];

  return (
    <div className="ops-overview">
      <div className="overview-intro">
        <div>
          <p className="app-page-head__eyebrow">OPERATIONS DESK</p>
          <h2>The field queue, stock and team in one place.</h2>
          <p>Every figure below is a live count from the operations records. Empty stock stays empty until it is recorded.</p>
        </div>
        <button type="button" className="btn btn--outline btn--small" onClick={summary.refresh}>Refresh data</button>
      </div>

      {summary.error ? <p className="app-notice app-notice--error" role="alert">Operations summary is unavailable: {summary.error}</p> : null}

      <section className="overview-metrics" aria-label="Operations summary">
        {metrics.map(([label, value, note]) => (
          <article className="overview-metric" key={label}>
            <span>{label}</span>
            <strong>{value === null || value === undefined ? '—' : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <div className="ops-split">
        <Panel heading="Queue by status" action={<Link className="panel__link" to="/operations/queue">Open queue →</Link>}>
          {jobs ? (
            <table className="users-table ops-table-plain">
              <thead><tr><th>Status</th><th>Jobs</th><th>Share</th></tr></thead>
              <tbody>
                {JOB_STATUS_OPTIONS.map((option) => {
                  const count = jobs[option.value] ?? 0;
                  const share = jobs.total ? Math.round((count / jobs.total) * 100) : 0;
                  return (
                    <tr key={option.value}>
                      <td><StatusPill status={option.value} label={option.label} /></td>
                      <td className="ops-number">{count}</td>
                      <td>
                        <span className="ops-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                        <span className="ops-bar__label">{share}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="data-state">{summary.status === 'loading' ? 'Loading queue…' : 'Queue data unavailable.'}</p>}
        </Panel>

        <Panel heading="Stock position" action={<Link className="panel__link" to="/operations/inventory">Inventory →</Link>}>
          <table className="users-table ops-table-plain">
            <thead><tr><th>Held</th><th>Available</th><th>Assigned</th></tr></thead>
            <tbody>
              <tr>
                <td>Devices</td>
                <td className="ops-number">{inventory?.devices?.in_stock ?? '—'}</td>
                <td className="ops-number">{inventory?.devices?.assigned ?? '—'}</td>
              </tr>
              <tr>
                <td>SIM cards</td>
                <td className="ops-number">{inventory?.sims?.in_stock ?? '—'}</td>
                <td className="ops-number">{inventory?.sims?.assigned ?? '—'}</td>
              </tr>
              <tr>
                <td>Technicians</td>
                <td className="ops-number">{technicians?.active ?? '—'}</td>
                <td className="ops-number">{technicians?.total ?? '—'}</td>
              </tr>
            </tbody>
          </table>
          <p className="ops-foot-note">Available: unallocated stock. Assigned: out with a job or technician.</p>
        </Panel>
      </div>

      <StationStockPanel />

      <TechnicianStockPanel />

      <Panel heading="Recently pushed work" action={<Link className="panel__link" to="/operations/queue">View all →</Link>}>
        {recent.error ? <p className="app-notice app-notice--error" role="alert">{recent.error}</p> : null}
        {recent.status === 'loading' ? <p className="data-state">Loading recent work…</p> : null}
        {recent.status !== 'loading' && !recent.error && recent.rows.length === 0 ? (
          <div className="app-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>Nothing has reached operations yet</h2>
            <p>Work appears the moment a salesperson or the desk pushes a customer request. No sample jobs are displayed.</p>
          </div>
        ) : null}
        {recent.rows.length > 0 ? (
          <ul className="ops-feed">
            {recent.rows.map((job) => (
              <li key={job.id}>
                <span className="ops-feed__ref">{job.reference}</span>
                <div>
                  <strong>{job.customerName || 'Customer'}</strong>
                  <p>{[job.vehicle.label, job.vehicle.registration, job.vehicle.station].filter(Boolean).join(' · ') || job.phone || 'No vehicle details'}</p>
                </div>
                <StatusPill status={job.status} label={job.statusLabel} />
                <time>{formatDayTime(job.createdAt)}</time>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}
