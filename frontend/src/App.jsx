import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { homeFor } from './app/roles.js';
import { adminWorkspace, operationsWorkspace } from './app/workspaces.js';
import AppLayout from './components/app/AppLayout.jsx';
import PublicLayout from './components/layout/PublicLayout.jsx';
import AuthSplash from './components/auth/AuthSplash.jsx';
import { useAuth } from './context/auth.js';
import LandingPage from './pages/LandingPage.jsx';
import ActivityPage from './pages/app/ActivityPage.jsx';
import ComplaintsPage from './pages/app/ComplaintsPage.jsx';
import CustomerDetailPage from './pages/app/CustomerDetailPage.jsx';
import CustomersPage from './pages/app/CustomersPage.jsx';
import FollowUpsPage from './pages/app/FollowUpsPage.jsx';
import OperationsPage from './pages/app/OperationsPage.jsx';
import OverviewPage from './pages/app/OverviewPage.jsx';
import PricingPage from './pages/app/PricingPage.jsx';
import ReportsPage from './pages/app/ReportsPage.jsx';
import RoleWorkspacePage from './pages/roles/RoleWorkspacePage.jsx';
import SalesPage from './pages/app/SalesPage.jsx';
import SettingsPage from './pages/app/SettingsPage.jsx';
import UsersPage from './pages/app/UsersPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SignInPage from './pages/auth/SignInPage.jsx';
import SystemStatusPage from './pages/SystemStatusPage.jsx';
import OperationsComplaintsPage from './pages/operations/OperationsComplaintsPage.jsx';
import OperationsInventoryPage from './pages/operations/OperationsInventoryPage.jsx';
import OperationsOverviewPage from './pages/operations/OperationsOverviewPage.jsx';
import OperationsQueuePage from './pages/operations/OperationsQueuePage.jsx';
import OperationsReportsPage from './pages/operations/OperationsReportsPage.jsx';
import OperationsSettingsPage from './pages/operations/OperationsSettingsPage.jsx';
import OperationsTechniciansPage from './pages/operations/OperationsTechniciansPage.jsx';

function RequireSession() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <AuthSplash label="Checking your session…" />;
  if (auth.status !== 'authenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/sign-in?from=${encodeURIComponent(from)}`} replace />;
  }
  return <Outlet />;
}

function RequireWorkspaceRole({ role }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to={homeFor(user?.role)} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sign-in" replace />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/welcome" element={<PublicLayout />}><Route index element={<LandingPage />} /></Route>
      <Route path="/status" element={<PublicLayout />}><Route index element={<SystemStatusPage />} /></Route>
      <Route element={<RequireSession />}>
        <Route element={<RequireWorkspaceRole role="admin" />}>
          <Route path="/admin" element={<AppLayout workspace={adminWorkspace} />}>
            <Route index element={<OverviewPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route element={<RequireWorkspaceRole role="salesperson" />}>
          <Route path="/salesperson" element={<RoleWorkspacePage role="salesperson" />} />
        </Route>
        <Route element={<RequireWorkspaceRole role="manager" />}>
          <Route path="/manager" element={<RoleWorkspacePage role="manager" />} />
        </Route>
        <Route element={<RequireWorkspaceRole role="operations" />}>
          <Route path="/operations" element={<AppLayout workspace={operationsWorkspace} />}>
            <Route index element={<OperationsOverviewPage />} />
            <Route path="queue" element={<OperationsQueuePage />} />
            <Route path="complaints" element={<OperationsComplaintsPage />} />
            <Route path="inventory" element={<OperationsInventoryPage />} />
            <Route path="technicians" element={<OperationsTechniciansPage />} />
            <Route path="reports" element={<OperationsReportsPage />} />
            <Route path="settings" element={<OperationsSettingsPage />} />
            <Route path="*" element={<Navigate to="/operations" replace />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
