import { useMemo, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useUsers } from '../../hooks/useUsers.js';
import CreateUserDrawer from '../../components/users/CreateUserDrawer.jsx';
import Panel from '../../components/app/Panel.jsx';
import { roleLabels } from '../../app/roles.js';

export default function UsersPage() {
  useDocumentTitle('Users');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const users = useUsers();
  const rows = useMemo(() => users.rows.filter((user) => (role === 'all' || user.role === role)
    && `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase().trim())), [users.rows, role, search]);

  return <div className="users-page">
    <Panel heading="Team accounts" action={<button type="button" className="btn btn--primary btn--small" onClick={() => setDrawerOpen(true)}>New account</button>}>
      <p className="panel__note">Create staff logins for Salesperson, Manager and Operations. Each account is validated and its password is hashed by the backend.</p>
      <div className="users-toolbar"><input aria-label="Search accounts" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter accounts by role" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option><option value="admin">Admin</option><option value="salesperson">Salesperson</option><option value="manager">Manager</option><option value="operations">Operations</option></select><button className="btn btn--outline btn--small" type="button" onClick={users.refresh}>Refresh</button></div>
      {users.error ? <p className="app-notice app-notice--error" role="alert">{users.error}</p> : null}
      {users.status === 'loading' ? <p className="data-state" role="status">Loading accounts…</p> : null}
      {users.status !== 'loading' && !users.error && rows.length === 0 ? <div className="app-empty"><span className="app-empty__mark" aria-hidden="true">—</span><h2>{users.rows.length ? 'No matching accounts' : 'No accounts to show'}</h2><p>{users.rows.length ? 'Try another search or role filter.' : 'Accounts will appear here when created. No sample users are shown.'}</p></div> : null}
      {rows.length > 0 ? <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{roleLabels[user.role] ?? user.role}</td><td><span className="status-badge">{user.active ? 'Active' : 'Inactive'}</span></td><td>{user.createdAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(user.createdAt)) : '—'}</td></tr>)}</tbody></table></div> : null}
    </Panel>
    <CreateUserDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCreated={users.create} />
  </div>;
}
