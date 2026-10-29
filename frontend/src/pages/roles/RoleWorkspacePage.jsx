import { Navigate } from 'react-router-dom';
import Panel from '../../components/app/Panel.jsx';
import { roleLabels, roleHome } from '../../app/roles.js';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const roleNotes = {
  salesperson: 'Salesperson workflows for customer ownership, follow-ups, sales and renewals will be built here.',
  manager: 'Manager workflows for customer lookup, invoices, payments and certificates will be built here.',
  operations: 'Operations workflows for jobs, technicians, stations, IMEI devices and SIM stock will be built here.',
};

export default function RoleWorkspacePage({ role }) {
  const { user, logout } = useAuth();
  useDocumentTitle(`${roleLabels[role]} workspace`);

  if (user?.role !== role) return <Navigate to={roleHome[user?.role] ?? '/sign-in'} replace />;

  return (
    <div className="app-frame">
      <main className="app-main role-workspace">
        <header className="app-topbar">
          <p className="app-crumb"><strong>TrackMaster Hub · {roleLabels[role]}</strong></p>
          <button type="button" className="btn btn--outline btn--small" onClick={logout}>Sign out</button>
        </header>
        <div className="app-content">
          <div className="role-workspace__head">
            <p className="app-page-head__eyebrow">TRACKMASTER HUB · {roleLabels[role].toUpperCase()}</p>
            <h1>{roleLabels[role]} workspace</h1>
            <p>{roleNotes[role]}</p>
          </div>
          <Panel heading="Workspace access">
            <p className="panel__note">Signed in as {user.name} ({user.email}). This role is verified by the server; the admin workspace and its data are not accessible from this account.</p>
            <button type="button" className="btn btn--outline btn--small" onClick={logout}>Sign out</button>
          </Panel>
        </div>
      </main>
    </div>
  );
}
