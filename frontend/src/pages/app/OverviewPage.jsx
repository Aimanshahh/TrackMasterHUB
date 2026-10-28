import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function OverviewPage() {
  useDocumentTitle('Overview');

  return (
    <>
      <Panel heading="Live position">
        <p className="panel__note">
          The overview panel will show the live numbers: pending approvals, renewals due, open
          complaints and the operations queue.
        </p>
      </Panel>

      <Panel heading="Workspace">
        <p className="panel__note">
          These pages make up the admin workspace. Everything is shared from one database — the
          role-specific screens sit on top of the same records.
        </p>

        <ul className="panel__list">
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin">
              Overview
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/customers">
              Customers
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/follow-ups">
              Follow-ups
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/sales">
              Sales
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/operations">
              Operations
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/complaints">
              Complaints
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/reports">
              Reports
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/users">
              Users
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/activity">
              Activity
            </Link>
          </li>
          <li className="panel__list-item">
            <Link className="panel__link" to="/admin/settings">
              Settings
            </Link>
          </li>
        </ul>
      </Panel>
    </>
  );
}
