import { Link } from 'react-router-dom';

import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function SettingsPage() {
  useDocumentTitle('Settings');

  return <div className="settings-page">
    <Panel heading="Workspace access">
      <div className="settings-link-card">
        <div><p className="settings-link-card__eyebrow">Administration</p><h2>People &amp; roles</h2><p>Create staff accounts and review the roles currently assigned. Passwords are handled by the backend and stored as hashes.</p></div>
        <Link className="btn btn--outline btn--small" to="/admin/users">Manage accounts <span aria-hidden="true">→</span></Link>
      </div>
    </Panel>
    <Panel heading="Service health">
      <div className="settings-link-card">
        <div><p className="settings-link-card__eyebrow">API &amp; database</p><h2>Connection status</h2><p>Inspect the API and MongoDB connectivity independently, along with the current service version and uptime.</p></div>
        <Link className="btn btn--outline btn--small" to="/status">Open system status <span aria-hidden="true">→</span></Link>
      </div>
    </Panel>
    <div className="settings-note"><span aria-hidden="true">i</span><p>Organization preferences and notification controls are not implemented yet. No settings are presented as editable until they are persisted by the backend.</p></div>
  </div>;
}
