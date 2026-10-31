import { Link } from 'react-router-dom';

import Panel from '../../components/app/Panel.jsx';
import { roleLabels } from '../../app/roles.js';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function ManagerSettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();

  return (
    <div className="settings-page">
      <Panel heading="Your access">
        <div className="settings-link-card">
          <div>
            <p className="settings-link-card__eyebrow">Signed in</p>
            <h2>{user?.name} · {roleLabels[user?.role] ?? 'Manager'}</h2>
            <p>
              {user?.email}. The manager desk can look up any customer, complete security briefings, draft and issue
              invoices and record payments. Prices, staff accounts and approvals stay with the admin.
            </p>
          </div>
          <Link className="btn btn--outline btn--small" to="/manager/customers">Open customer lookup <span aria-hidden="true">→</span></Link>
        </div>
      </Panel>

      <Panel heading="Sensitive records">
        <div className="settings-note">
          <span aria-hidden="true">i</span>
          <p>
            CNIC, date of birth, E-PIN and secondary-user details are visible only on this desk and to the admin. They are
            never included in lists, notifications, exports or the salesperson app, and every briefing completion is written
            to the activity log with the name of the manager who recorded it.
          </p>
        </div>
      </Panel>

      <Panel heading="Money records">
        <div className="settings-note">
          <span aria-hidden="true">i</span>
          <p>
            Invoices are issued once and cannot be edited afterwards. Payments are appended against the invoice, so a part
            payment is a dated record rather than an adjustment. Cancelling an invoice that already has money against it is
            blocked; that case needs a refund or credit note, which is not built yet.
          </p>
        </div>
      </Panel>

      <Panel heading="Service health">
        <div className="settings-link-card">
          <div>
            <p className="settings-link-card__eyebrow">API &amp; database</p>
            <h2>Connection status</h2>
            <p>Check that the API and MongoDB are reachable before chasing a missing record.</p>
          </div>
          <Link className="btn btn--outline btn--small" to="/status">Open system status <span aria-hidden="true">→</span></Link>
        </div>
      </Panel>
    </div>
  );
}
