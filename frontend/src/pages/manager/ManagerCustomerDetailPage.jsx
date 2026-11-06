import { useState } from 'react';
import { useParams } from 'react-router-dom';

import AdjustmentDrawer from '../../components/billing/AdjustmentDrawer.jsx';
import PaymentDrawer from '../../components/billing/PaymentDrawer.jsx';
import CustomerAccountView from '../../components/customers/CustomerAccountView.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useManagerCustomer } from '../../hooks/useManager.js';
import { issueInvoiceRecord, recordInvoicePayment } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';

export default function ManagerCustomerDetailPage() {
  const { customerId } = useParams();
  const profile = useManagerCustomer(customerId);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const customer = profile.data?.customer;
  useDocumentTitle(customer?.name ? `${customer.name} · Account` : 'Customer account');

  async function issue(invoice) {
    setBusyId(invoice.id);
    setError(null);
    setNotice(null);
    try {
      const payload = await issueInvoiceRecord(invoice.id);
      await profile.refresh();
      setNotice(`Invoice ${payload.data.invoice.reference} issued. Payments can now be recorded against it.`);
    } catch (error_) {
      setError(error_.message || 'The invoice could not be issued.');
    } finally {
      setBusyId(null);
    }
  }

  async function recordPayment(id, input) {
    const payload = await recordInvoicePayment(id, input);
    await profile.refresh();
    setNotice(
      payload.data.invoice.balance > 0
        ? `Payment recorded. ${formatMoney(payload.data.invoice.balance)} still outstanding on ${payload.data.invoice.reference}.`
        : `Payment recorded. ${payload.data.invoice.reference} is settled in full.`,
    );
  }

  async function adjustmentDone(adjustment, kind) {
    await profile.refresh();
    setNotice(`${kind === 'refund' ? 'Refund' : 'Credit note'} ${adjustment.reference} recorded for ${formatMoney(adjustment.amount)}.`);
  }

  if (profile.status === 'loading') return <p className="data-state" role="status">Loading customer account…</p>;

  if (profile.error && !profile.data) {
    return (
      <div className="app-empty">
        <span className="app-empty__mark" aria-hidden="true">—</span>
        <h2>This account could not be opened</h2>
        <p>{profile.error}</p>
      </div>
    );
  }

  if (!profile.data) return null;

  return (
    <div className="mgr-account-page">
      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}

      <CustomerAccountView
        data={profile.data}
        backTo="/manager/customers"
        backLabel="Customer lookup"
        saving={profile.saving}
        onSaveBriefing={profile.saveBriefing}
        onIssueInvoice={issue}
        onPayInvoice={(invoice) => setPayingInvoice(invoice)}
        onCreditInvoice={(invoice) => setAdjusting({ invoice, kind: 'credit_note' })}
        onRefundInvoice={(invoice) => setAdjusting({ invoice, kind: 'refund' })}
        busyInvoiceId={busyId}
        onVehicleSaved={() => {
          profile.refresh();
          setNotice('Vehicle details updated.');
        }}
      />

      <PaymentDrawer
        invoice={payingInvoice}
        open={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        onSubmit={recordPayment}
      />

      <AdjustmentDrawer
        invoice={adjusting?.invoice}
        kind={adjusting?.kind}
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        onDone={adjustmentDone}
      />
    </div>
  );
}
