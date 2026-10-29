import { useAuth } from '../../context/auth.js';
import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsSettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();

  return (
    <div className="settings-page">
      <Panel heading="Workspace access">
        <p className="panel__note">
          You are signed in as {user?.name} ({user?.email}). The operations desk can manage the work queue,
          complaints, device and SIM stock, and technician records. Access is enforced by the API for every
          request, not only by hidden buttons.
        </p>
        <p className="panel__note">
          Staff accounts are issued by an admin. Operations cannot create logins or change another account&rsquo;s role.
        </p>
      </Panel>

      <Panel heading="Stock and assignment rules">
        <p className="panel__note">
          A device or SIM can only be allocated while it is marked available. Assigning it to a job moves it out of
          available stock; cancelling that job returns it. The server rejects an item that is already assigned elsewhere.
        </p>
        <p className="panel__note">
          Completing a new installation requires both the device IMEI and the SIM number, so stock history always
          matches what was fitted to the vehicle.
        </p>
      </Panel>

      <Panel heading="Status notifications">
        <p className="panel__note">
          When a complaint or installation status changes, the salesperson who pushed that record receives an in-app
          notification. Notifications never include CNIC, date of birth, E-PIN or secondary-user details.
        </p>
      </Panel>
    </div>
  );
}
