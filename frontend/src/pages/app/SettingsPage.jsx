import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function SettingsPage() {
  useDocumentTitle('Settings');

  return (
    <>
      <Panel heading="Workspace settings">
        <p className="panel__note">
          Workspace settings are not yet configured. The backend reads the workspace name, the
          support email and the notification preferences from its environment.
        </p>
      </Panel>

      <Panel heading="Access">
        <p className="panel__note">
          Users, roles and access are issued from this workspace. Only an admin can create an
          account, and only an admin can change another account&rsquo;s role.
        </p>
      </Panel>

      <Panel heading="System health">
        <p className="panel__note">
          Connection status, version and uptime are shown on the System status page.
        </p>
      </Panel>
    </>
  );
}
