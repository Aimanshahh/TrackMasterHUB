import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { homeFor } from './app/roles.js';
import {
  adminWorkspace,
  managerWorkspace,
  operationsWorkspace,
  salespersonWorkspace,
  technicianWorkspace,
} from './app/workspaces.js';
import AppLayout from './components/app/AppLayout.jsx';
import PublicLayout from './components/layout/PublicLayout.jsx';
import AuthSplash from './components/auth/AuthSplash.jsx';
import { useAuth } from './context/auth.js';
import LandingPage from './pages/LandingPage.jsx';
import ActivityPage from './pages/app/ActivityPage.jsx';
import ApprovalsPage from './pages/app/ApprovalsPage.jsx';
import ComplaintsPage from './pages/app/ComplaintsPage.jsx';
import CustomerDetailPage from './pages/app/CustomerDetailPage.jsx';
import CustomersPage from './pages/app/CustomersPage.jsx';
import FollowUpsPage from './pages/app/FollowUpsPage.jsx';
import OperationsPage from './pages/app/OperationsPage.jsx';
import OverviewPage from './pages/app/OverviewPage.jsx';
import MoneyPage from './pages/app/MoneyPage.jsx';
import PendingInstallationsPage from './pages/app/PendingInstallationsPage.jsx';
import VehicleProfilePage from './pages/app/VehicleProfilePage.jsx';
import VehicleRecordsPage from './pages/app/VehicleRecordsPage.jsx';
import PricingPage from './pages/app/PricingPage.jsx';
import QuotationsPage from './pages/app/QuotationsPage.jsx';
import ReportsPage from './pages/app/ReportsPage.jsx';
import SalesPage from './pages/app/SalesPage.jsx';
import SettingsPage from './pages/app/SettingsPage.jsx';
import UsersPage from './pages/app/UsersPage.jsx';
import SalespersonPerformancePage from './pages/app/SalespersonPerformancePage.jsx';
import SalesPerformancePage from './pages/app/SalesPerformancePage.jsx';
import AdminMessagesPage from './pages/app/AdminMessagesPage.jsx';
import OperationsCustomersPage from './pages/app/OperationsCustomersPage.jsx';
import OperationsCustomerDetailPage from './pages/app/OperationsCustomerDetailPage.jsx';
import OperationsWhatsAppPage from './pages/app/OperationsWhatsAppPage.jsx';
import AdjustmentPrintPage from './pages/billing/AdjustmentPrintPage.jsx';
import CertificatesPage from './pages/app/CertificatesPage.jsx';
import ImportCustomersPage from './pages/app/ImportCustomersPage.jsx';
import CallLogsPage from './pages/app/CallLogsPage.jsx';
import CustomerHistoryReportPage from './pages/billing/CustomerHistoryReportPage.jsx';
import InvoicePrintPage from './pages/billing/InvoicePrintPage.jsx';
import QuotationPrintPage from './pages/billing/QuotationPrintPage.jsx';
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
import ManagerBriefingPendingPage from './pages/manager/ManagerBriefingPendingPage.jsx';
import ManagerComplaintsPage from './pages/manager/ManagerComplaintsPage.jsx';
import ManagerCustomerDetailPage from './pages/manager/ManagerCustomerDetailPage.jsx';
import ManagerCustomersPage from './pages/manager/ManagerCustomersPage.jsx';
import ManagerInvoicesPage from './pages/manager/ManagerInvoicesPage.jsx';
import ManagerOverviewPage from './pages/manager/ManagerOverviewPage.jsx';
import ManagerPaymentsPage from './pages/manager/ManagerPaymentsPage.jsx';
import ManagerReportsPage from './pages/manager/ManagerReportsPage.jsx';
import ManagerSettingsPage from './pages/manager/ManagerSettingsPage.jsx';
import SalespersonComplaintsPage from './pages/salesperson/SalespersonComplaintsPage.jsx';
import SalespersonCustomerDetailPage from './pages/salesperson/SalespersonCustomerDetailPage.jsx';
import SalespersonCustomersPage from './pages/salesperson/SalespersonCustomersPage.jsx';
import SalespersonFollowUpsPage from './pages/salesperson/SalespersonFollowUpsPage.jsx';
import SalespersonOverviewPage from './pages/salesperson/SalespersonOverviewPage.jsx';
import SalespersonRequestsPage from './pages/salesperson/SalespersonRequestsPage.jsx';
import SalespersonSalesPage from './pages/salesperson/SalespersonSalesPage.jsx';
import SalespersonSettingsPage from './pages/salesperson/SalespersonSettingsPage.jsx';
import SalespersonHotLeadsPage from './pages/salesperson/SalespersonHotLeadsPage.jsx';
import TechnicianPaymentsPage from './pages/app/TechnicianPaymentsPage.jsx';
import OperationsReviewsPage from './pages/operations/OperationsReviewsPage.jsx';
import OperationsMicrophonesPage from './pages/operations/OperationsMicrophonesPage.jsx';
import TechnicianOverviewPage from './pages/technician/TechnicianOverviewPage.jsx';
import TechnicianJobsPage from './pages/technician/TechnicianJobsPage.jsx';
import TechnicianJobPage from './pages/technician/TechnicianJobPage.jsx';
import TechnicianStockPage from './pages/technician/TechnicianStockPage.jsx';
import TechnicianEarningsPage from './pages/technician/TechnicianEarningsPage.jsx';
import TechnicianSettingsPage from './pages/technician/TechnicianSettingsPage.jsx';

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
        <Route path="/invoices/:invoiceId/print" element={<InvoicePrintPage />} />
        <Route path="/customers/:customerId/report" element={<CustomerHistoryReportPage />} />
        <Route path="/adjustments/:adjustmentId/print" element={<AdjustmentPrintPage />} />
        <Route path="/quotations/:quotationId/print" element={<QuotationPrintPage />} />
        <Route element={<RequireWorkspaceRole role="admin" />}>
          <Route path="/admin" element={<AppLayout workspace={adminWorkspace} />}>
            <Route index element={<OverviewPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="quotations" element={<QuotationsPage customerLink={(id) => `/admin/customers/${id}`} />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="pending-installations" element={<PendingInstallationsPage />} />
            <Route path="vehicles" element={<VehicleRecordsPage />} />
            <Route path="vehicles/:id" element={<VehicleProfilePage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="import" element={<ImportCustomersPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="calls" element={<CallLogsPage />} />
            <Route path="sales-performance" element={<SalesPerformancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="money" element={<MoneyPage />} />
            <Route path="technician-payments" element={<TechnicianPaymentsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id/performance" element={<SalespersonPerformancePage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route element={<RequireWorkspaceRole role="salesperson" />}>
          <Route path="/salesperson" element={<AppLayout workspace={salespersonWorkspace} />}>
            <Route index element={<SalespersonOverviewPage />} />
            <Route path="customers" element={<SalespersonCustomersPage />} />
            <Route path="customers/:customerId" element={<SalespersonCustomerDetailPage />} />
            <Route path="follow-ups" element={<SalespersonFollowUpsPage />} />
            <Route path="requests" element={<SalespersonRequestsPage />} />
            <Route path="complaints" element={<SalespersonComplaintsPage />} />
            <Route path="quotations" element={<QuotationsPage customerLink={(id) => `/salesperson/customers/${id}`} />} />
            <Route path="sales" element={<SalespersonSalesPage />} />
            <Route path="hot-leads" element={<SalespersonHotLeadsPage />} />
            <Route path="settings" element={<SalespersonSettingsPage />} />
            <Route path="*" element={<Navigate to="/salesperson" replace />} />
          </Route>
        </Route>
        <Route element={<RequireWorkspaceRole role="manager" />}>
          <Route path="/manager" element={<AppLayout workspace={managerWorkspace} />}>
            <Route index element={<ManagerOverviewPage />} />
            <Route path="customers" element={<ManagerCustomersPage />} />
            <Route path="customers/:customerId" element={<ManagerCustomerDetailPage />} />
            <Route path="briefing-pending" element={<ManagerBriefingPendingPage />} />
            <Route path="vehicles" element={<VehicleRecordsPage />} />
            <Route path="vehicles/:id" element={<VehicleProfilePage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="invoices" element={<ManagerInvoicesPage />} />
            <Route path="payments" element={<ManagerPaymentsPage />} />
            <Route path="complaints" element={<ManagerComplaintsPage />} />
            <Route path="reports" element={<ManagerReportsPage />} />
            <Route path="settings" element={<ManagerSettingsPage />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Route>
        </Route>
        <Route element={<RequireWorkspaceRole role="operations" />}>
          <Route path="/operations" element={<AppLayout workspace={operationsWorkspace} />}>
            <Route index element={<OperationsOverviewPage />} />
            <Route path="queue" element={<OperationsQueuePage />} />
            <Route path="pending-installations" element={<PendingInstallationsPage />} />
            <Route path="customers" element={<OperationsCustomersPage />} />
            <Route path="customers/:customerId" element={<OperationsCustomerDetailPage />} />
            <Route path="whatsapp" element={<OperationsWhatsAppPage />} />
            <Route path="vehicles" element={<VehicleRecordsPage />} />
            <Route path="vehicles/:id" element={<VehicleProfilePage />} />
            <Route path="complaints" element={<OperationsComplaintsPage />} />
            <Route path="calls" element={<CallLogsPage />} />
            <Route path="inventory" element={<OperationsInventoryPage />} />
            <Route path="technicians" element={<OperationsTechniciansPage />} />
            <Route path="reviews" element={<OperationsReviewsPage />} />
            <Route path="microphones" element={<OperationsMicrophonesPage />} />
            <Route path="reports" element={<OperationsReportsPage />} />
            <Route path="settings" element={<OperationsSettingsPage />} />
            <Route path="*" element={<Navigate to="/operations" replace />} />
          </Route>
        </Route>
        <Route element={<RequireWorkspaceRole role="technician" />}>
          <Route path="/technician" element={<AppLayout workspace={technicianWorkspace} />}>
            <Route index element={<TechnicianOverviewPage />} />
            <Route path="installations" element={<TechnicianJobsPage />} />
            <Route path="installations/:id" element={<TechnicianJobPage />} />
            <Route path="stock" element={<TechnicianStockPage />} />
            <Route path="earnings" element={<TechnicianEarningsPage />} />
            <Route path="settings" element={<TechnicianSettingsPage />} />
            <Route path="*" element={<Navigate to="/technician" replace />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
