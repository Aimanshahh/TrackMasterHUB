import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useActivity } from '../../hooks/useActivity.js';
import Panel from '../../components/app/Panel.jsx';

export default function ActivityPage() {
  useDocumentTitle('Activity');
  const activity = useActivity();

  return <Panel heading="Recorded activity" action={<button type="button" className="btn btn--outline btn--small" onClick={activity.refresh}>Refresh</button>}>
    <div className="users-toolbar"><input aria-label="Search activity" placeholder="Search recorded actions" value={activity.search} onChange={(event) => activity.setSearch(event.target.value)} /><select aria-label="Filter activity type" value={activity.filter} onChange={(event) => activity.setFilter(event.target.value)}><option value="all">All activity</option><option value="customer.created">Customers created</option><option value="user.created">Users created</option><option value="user.role_changed">Role changes</option></select></div>
    {activity.error ? <p className="app-notice app-notice--error" role="alert">{activity.error}</p> : null}
    {activity.status === 'loading' ? <p className="data-state" role="status">Loading recorded activity…</p> : null}
    {activity.status === 'ready' && activity.rows.length === 0 ? <div className="app-empty"><span className="app-empty__mark" aria-hidden="true">—</span><h2>No activity recorded</h2><p>Recorded actions will appear here. No demo activity is generated.</p></div> : null}
    {activity.rows.length > 0 ? <ul className="activity-list">{activity.rows.map((row) => <li key={row.id}><span className="activity-list__mark" aria-hidden="true" /><div><strong>{row.label || row.type}</strong><p>{row.description}</p></div><time>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</time></li>)}</ul> : null}
  </Panel>;
}
