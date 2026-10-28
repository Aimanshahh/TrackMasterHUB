import { useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import CreateUserDrawer from '../../components/users/CreateUserDrawer.jsx';
import Panel from '../../components/app/Panel.jsx';

export default function UsersPage() {
  useDocumentTitle('Users');

  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleCreated() {
    setDrawerOpen(false);
  }

  return (
    <div className="users-page">
      <Panel
        heading="Accounts"
        action={
          <button type="button" className="btn btn--primary" onClick={() => setDrawerOpen(true)}>
            New account
          </button>
        }
      >
        <p className="panel__note">
          Only an admin can create an account. The account details below are issued by you and not
          recoverable from this screen — store them somewhere safe.
        </p>
      </Panel>

      <CreateUserDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
