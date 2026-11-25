import SalesBoard from '../../components/sales/SalesBoard.jsx';
import { useSalesBoard } from '../../components/sales/useSalesBoard.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchMySales } from '../../lib/api.js';

/** The salesperson's own sales, price approvals and renewals. Nothing here is company-wide. */
export default function SalespersonSalesPage() {
  useDocumentTitle('Sales & renewals');
  const { status, board, error, reload } = useSalesBoard(fetchMySales);

  if (status === 'loading') return <p className="data-state" role="status">Loading your sales…</p>;
  if (status === 'error') return <p className="app-notice app-notice--error" role="alert">Your sales could not be loaded: {error}</p>;
  return <SalesBoard board={board} mode="mine" onChanged={reload} customerLink={(id) => `/salesperson/customers/${id}`} />;
}
