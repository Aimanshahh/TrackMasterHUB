import { Route, Routes } from 'react-router-dom';

import PublicLayout from './components/layout/PublicLayout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SystemStatusPage from './pages/SystemStatusPage.jsx';

/**
 * Public routes live inside PublicLayout. Authenticated ERP/CRM modules will
 * mount under their own role-aware layout in a later phase.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="status" element={<SystemStatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
