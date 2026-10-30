import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function SalespersonSettingsPage() {
  useDocumentTitle('Settings');
  const { user, logout } = useAuth();

  return (
    <div className="sp-settings">
      <section className="sp-block">
        <header className="sp-block__head"><h3>Your account</h3></header>
        <dl className="sp-facts">
          <div><dt>Name</dt><dd>{user?.name ?? '—'}</dd></div>
          <div><dt>Email</dt><dd>{user?.email ?? '—'}</dd></div>
          <div><dt>Role</dt><dd>{user?.roleLabel ?? 'Salesperson'}</dd></div>
          <div><dt>Access</dt><dd>Your own customers, requests and tickets only</dd></div>
        </dl>
      </section>

      <section className="sp-block">
        <header className="sp-block__head"><h3>How your data is protected</h3></header>
        <ul className="sp-notes-list">
          <li>Your customers are assigned to your account by the server. Another salesperson cannot open them by changing the URL.</li>
          <li>Installation and ticket updates are created by the backend when operations changes a status — never by your browser.</li>
          <li>Sessions are httpOnly cookies and expire after seven days. Signing out ends the session on the server.</li>
        </ul>
      </section>

      <section className="sp-block">
        <header className="sp-block__head"><h3>Notifications</h3></header>
        <p className="sp-block__meta">
          In-app notifications arrive when operations assigns, schedules, starts or completes one of your requests, or moves
          one of your complaints. Email and WhatsApp updates will be added with the complaint messaging workflow.
        </p>
      </section>

      <section className="sp-block">
        <header className="sp-block__head"><h3>Session</h3></header>
        <button type="button" className="btn btn--outline btn--small" onClick={logout}>Sign out of this device</button>
      </section>
    </div>
  );
}
