import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import AppSidebar from './AppSidebar.jsx';
import AppTopbar from './AppTopbar.jsx';
import FieldTabs from './FieldTabs.jsx';
import PageHeader from './PageHeader.jsx';

export default function AppLayout({ workspace }) {
  const [navOpen, setNavOpen] = useState(false);
  const hasTabs = Boolean(workspace.tabs?.length);

  return (
    <div className={`app-frame${hasTabs ? ' app-frame--field' : ''}`}>
      <AppSidebar workspace={workspace} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="app-main">
        <AppTopbar workspace={workspace} onOpenNav={() => setNavOpen(true)} />
        <main className="app-content" id="main-content">
          <PageHeader workspace={workspace} />
          <div className="app-page">
            <Outlet />
          </div>
        </main>
        {hasTabs ? <FieldTabs tabs={workspace.tabs} /> : null}
      </div>
    </div>
  );
}
