import { useState } from 'react';

import Panel from '../../components/app/Panel.jsx';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function FollowUpsPage() {
  useDocumentTitle('Follow-ups');
  const [status, setStatus] = useState('upcoming');
  const customers = useCustomers({ followUp: status, limit: 100, sort: 'followUp', direction: 'asc' });
  const rows = customers.rows.filter((customer) => customer.followUp);

  return (
    <Panel heading="Customer follow-ups" action={<button type="button" className="btn btn--outline btn--small" onClick={customers.refresh}>Refresh</button>}>
      <div className="users-toolbar">
        <label htmlFor="follow-up-status">Due date</label>
        <select id="follow-up-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      {customers.error ? <p className="app-notice app-notice--error" role="alert">{customers.error}</p> : null}
      {customers.status === 'loading' ? <p className="data-state" role="status">Loading follow-up records…</p> : null}
      {customers.status !== 'loading' && !customers.error && rows.length === 0 ? <div className="app-empty"><span className="app-empty__mark" aria-hidden="true">—</span><h2>No {status} follow-ups</h2><p>Follow-ups will appear when actual customer records have a due date.</p></div> : null}
      {rows.length > 0 ? <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Customer</th><th>Contact</th><th>Priority</th><th>Due</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}<small>{row.company || '—'}</small></td><td>{row.phone || row.email}</td><td>{row.priority}</td><td>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(row.followUp))}</td></tr>)}</tbody></table></div> : null}
    </Panel>
  );
}
