import { useParams } from 'react-router-dom';

import CustomerAccountView from '../../components/customers/CustomerAccountView.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useManagerCustomer } from '../../hooks/useManager.js';

/**
 * The admin's view of one customer. It reads the same profile endpoint as the
 * manager desk, so the briefing, vehicles, invoices and payment history are
 * identical. Money actions live on the money records screen instead of being
 * duplicated here.
 */
export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const profile = useManagerCustomer(customerId);
  const customer = profile.data?.customer;

  useDocumentTitle(customer?.name ? `${customer.name} · Customer` : 'Customer record');

  if (profile.status === 'loading') return <p className="data-state" role="status">Loading customer record…</p>;

  if (profile.error && !profile.data) {
    return (
      <div className="app-empty">
        <span className="app-empty__mark" aria-hidden="true">—</span>
        <h2>This customer could not be opened</h2>
        <p>{profile.error}</p>
      </div>
    );
  }

  if (!profile.data) return null;

  return (
    <CustomerAccountView
      data={profile.data}
      backTo="/admin/customers"
      backLabel="Customer register"
      saving={profile.saving}
      onSaveBriefing={profile.saveBriefing}
      moneyLink="/admin/money"
    />
  );
}
