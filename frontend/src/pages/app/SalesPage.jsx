import SalesBoard from '../../components/sales/SalesBoard.jsx';
import { useSalesBoard } from '../../components/sales/useSalesBoard.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchSalesOverview } from '../../lib/api.js';

/** Company-wide sales for the admin: every salesperson, price approvals and renewals due. */
export default function SalesPage() {
  useDocumentTitle('Sales');
  const { status, board, error, reload } = useSalesBoard(fetchSalesOverview);

  if (status === 'loading') return <p className="data-state" role="status">Loading sales…</p>;
  if (status === 'error') return <p className="app-notice app-notice--error" role="alert">Sales could not be loaded: {error}</p>;
  return <SalesBoard board={board} mode="company" onChanged={reload} customerLink={(id) => `/admin/customers/${id}`} approvalsLink="/admin/approvals" />;
}
