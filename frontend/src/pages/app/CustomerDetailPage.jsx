import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import CustomerAccountView from '../../components/customers/CustomerAccountView.jsx';
import AmcPaymentDrawer from '../../components/billing/AmcPaymentDrawer.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useManagerCustomer } from '../../hooks/useManager.js';
import { deleteCustomerRecord, updateCustomer, recordAmcPayment } from '../../lib/api.js';

/**
 * The admin's view of one customer. It reads the same profile endpoint as the
 * manager desk, so the briefing, vehicles, invoices and payment history are
 * identical. Money actions live on the money records screen instead of being
 * duplicated here.
 */
export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const profile = useManagerCustomer(customerId);
  const customer = profile.data?.customer;
  const [amcPaymentOpen, setAmcPaymentOpen] = useState(false);
  const [notice, setNotice] = useState(null);

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

  async function deleteCustomer() {
    const confirmed = window.confirm(`Delete ${customer.name}? This cannot be undone. Customers with invoice history cannot be deleted.`);
    if (!confirmed) return;
    try {
      await deleteCustomerRecord(customerId);
      navigate('/admin/customers');
    } catch (error) {
      window.alert(error.message || 'The customer could not be deleted.');
    }
  }

  async function saveCustomer(input) {
    await updateCustomer(customerId, input);
    await profile.refresh();
  }

  async function recordAmc(customerId, input) {
    const payload = await recordAmcPayment(customerId, input);
    await profile.refresh();
    setNotice(`AMC payment recorded. ${payload.data.job.vehicle.registration || payload.data.job.reference} is renewed until ${new Date(payload.data.payment.amcExpiryDate).toLocaleDateString('en-GB')}.`);
  }

  return (
    <div className="mgr-account-page">
      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      <CustomerAccountView
        data={profile.data}
        backTo="/admin/customers"
        backLabel="Customer register"
        saving={profile.saving}
        onSaveBriefing={profile.saveBriefing}
        moneyLink="/admin/money"
        onVehicleSaved={() => profile.refresh()}
        onSaveCustomer={saveCustomer}
        onDeleteCustomer={deleteCustomer}
        onRecordAmcPayment={() => setAmcPaymentOpen(true)}
      />
      <AmcPaymentDrawer
        customer={customer}
        jobs={profile.data?.jobs ?? []}
        open={amcPaymentOpen}
        onClose={() => setAmcPaymentOpen(false)}
        onSubmit={recordAmc}
      />
    </div>
  );
}
