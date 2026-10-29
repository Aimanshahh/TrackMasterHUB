import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useDashboard } from '../../hooks/useDashboard.js';
import Panel from '../../components/app/Panel.jsx';

const reportRows = [
  ['Customer records', 'totalCustomers'],
  ['Admin accounts', 'admins'],
  ['Salesperson accounts', 'salespeople'],
  ['Manager accounts', 'managers'],
  ['Operations accounts', 'operationsUsers'],
];

export default function ReportsPage() {
  useDocumentTitle('Reports');
  const dashboard = useDashboard();
  const counts = dashboard.data?.counts;

  return (
    <Panel heading="Available business data" action={<button type="button" className="btn btn--outline btn--small" onClick={dashboard.refresh}>Refresh</button>}>
      <p className="panel__note">This report includes only record counts currently returned by MongoDB. Sales, revenue, renewals and operations metrics are not shown until those records and APIs exist.</p>
      {dashboard.error ? <p className="app-notice app-notice--error" role="alert">Report data is unavailable: {dashboard.error}</p> : null}
      {dashboard.status === 'loading' ? <p className="data-state" role="status">Loading report data…</p> : null}
      {counts ? <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Record type</th><th>Current total</th></tr></thead><tbody>{reportRows.map(([label, key]) => <tr key={key}><td>{label}</td><td>{counts[key] ?? 0}</td></tr>)}</tbody></table></div> : null}
    </Panel>
  );
}
