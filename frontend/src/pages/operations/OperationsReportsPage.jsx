import { JOB_STATUS_OPTIONS } from '../../app/operations.js';
import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useOperationsSummary } from '../../hooks/useOperations.js';

export default function OperationsReportsPage() {
  useDocumentTitle('Operations reports');
  const summary = useOperationsSummary();
  const jobs = summary.data?.jobs;
  const inventory = summary.data?.inventory;
  const technicians = summary.data?.technicians;

  return (
    <>
      <Panel heading="Recorded workload" action={<button type="button" className="btn btn--outline btn--small" onClick={summary.refresh}>Refresh</button>}>
        <p className="panel__note">Totals are counted from operations records. Date-range reporting will be added once the sales and job history workflow is connected.</p>
        {summary.error ? <p className="app-notice app-notice--error" role="alert">Report data is unavailable: {summary.error}</p> : null}
        {summary.status === 'loading' ? <p className="data-state" role="status">Loading report data…</p> : null}
        {jobs ? (
          <div className="ops-report-grid">
            <table className="users-table ops-table-plain">
              <thead><tr><th>Job status</th><th>Total</th></tr></thead>
              <tbody>
                {JOB_STATUS_OPTIONS.map((option) => (
                  <tr key={option.value}><td>{option.label}</td><td className="ops-number">{jobs[option.value] ?? 0}</td></tr>
                ))}
                <tr><td><strong>All jobs</strong></td><td className="ops-number"><strong>{jobs.total}</strong></td></tr>
              </tbody>
            </table>

            <table className="users-table ops-table-plain">
              <thead><tr><th>Stock & team</th><th>Total</th><th>Available</th></tr></thead>
              <tbody>
                <tr><td>Devices</td><td className="ops-number">{inventory?.devices?.total ?? 0}</td><td className="ops-number">{inventory?.devices?.in_stock ?? 0}</td></tr>
                <tr><td>SIM cards</td><td className="ops-number">{inventory?.sims?.total ?? 0}</td><td className="ops-number">{inventory?.sims?.in_stock ?? 0}</td></tr>
                <tr><td>Technicians</td><td className="ops-number">{technicians?.total ?? 0}</td><td className="ops-number">{technicians?.active ?? 0}</td></tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <Panel heading="What is not reported yet">
        <p className="panel__note">Completion time per job, technician performance, stock ageing and complaint resolution time are not calculated until those workflows record reliable timestamps. No estimated or sample figures are shown.</p>
      </Panel>
    </>
  );
}
