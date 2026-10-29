import { Link } from 'react-router-dom';

import Panel from '../../components/app/Panel.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const metrics = [
  ['Customer records', 'totalCustomers'],
  ['Salesperson accounts', 'salespeople'],
  ['Manager accounts', 'managers'],
  ['Operations accounts', 'operationsUsers'],
];

export default function OverviewPage() {
  useDocumentTitle('Overview');
  const dashboard = useDashboard();
  const data = dashboard.data;

  return <div className="overview-page">
    <div className="overview-intro"><div><p className="app-page-head__eyebrow">LIVE BUSINESS RECORDS</p><h2>Built from what’s actually in the system.</h2><p>These values are returned by the backend from MongoDB. An empty database stays visibly empty.</p></div><button type="button" className="btn btn--outline btn--small" onClick={dashboard.refresh}>Refresh data</button></div>
    {dashboard.error ? <p className="app-notice app-notice--error" role="alert">Dashboard data is unavailable: {dashboard.error}</p> : null}
    {dashboard.status === 'loading' ? <p className="data-state" role="status">Loading business records…</p> : null}
    {data ? <><section className="overview-metrics" aria-label="Database counts">{metrics.map(([label, key]) => <article className="overview-metric" key={key}><span>{label}</span><strong>{data.counts?.[key] ?? 0}</strong><small>from current database records</small></article>)}</section>
      <Panel heading="Recent recorded activity" action={<Link className="panel__link" to="/admin/activity">View activity</Link>}>
        {data.recentActivity?.length ? <ul className="activity-list">{data.recentActivity.map((activity) => <li key={activity.id}><span className="activity-list__mark" aria-hidden="true" /><div><strong>{activity.label || activity.type}</strong><p>{activity.description || 'Recorded system activity'}</p></div><time>{activity.createdAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(activity.createdAt)) : '—'}</time></li>)}</ul> : <div className="app-empty"><span className="app-empty__mark" aria-hidden="true">—</span><h2>No activity recorded yet</h2><p>Actions will appear here as the backend records them. No sample activity is displayed.</p></div>}
      </Panel></> : null}
  </div>;
}
