import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import AppSidebar from './AppSidebar.jsx';
import AppTopbar from './AppTopbar.jsx';
import PageHeader from './PageHeader.jsx';

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-frame">
      <AppSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="app-main">
        <AppTopbar onOpenNav={() => setNavOpen(true)} />
        <main className="app-content" id="main-content">
          <PageHeader />
          <div className="app-page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
