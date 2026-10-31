import { Link } from 'react-router-dom';

import { formatMoney } from '../../lib/format.js';

const stateLabels = {
  draft: 'Not issued',
  unpaid: 'Unpaid',
  partial: 'Part paid',
  paid: 'Settled',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export function paymentStateOf(invoice) {
  if (invoice.status === 'cancelled') return 'cancelled';
  if (invoice.paidAmount >= invoice.amount) return 'paid';
  if (invoice.paidAmount > 0) return invoice.paymentState === 'overdue' ? 'overdue' : 'partial';
  return invoice.paymentState === 'overdue' ? 'overdue' : 'unpaid';
}

export function InvoiceStateTag({ invoice }) {
  const state = paymentStateOf(invoice);
  return (
    <span className="state-tag" data-state={state}>
      {stateLabels[state]}
    </span>
  );
}

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/**
 * The invoice ledger. Money columns are right-aligned and use tabular figures,
 * and each issued invoice shows how much of its own total has been received so a
 * part payment is obvious at a glance.
 */
export default function InvoiceTable({
  invoices,
  busyId = null,
  onIssue,
  onPay,
  customerPath,
  emptyMessage = 'No invoices yet.',
}) {
  if (!invoices.length) {
    return (
      <div className="app-empty">
        <span className="app-empty__mark" aria-hidden="true">—</span>
        <h2>No invoices here</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="ledger-scroll">
      <table className="ledger ledger--invoices">
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Customer</th>
            <th scope="col" className="ledger__num">Amount</th>
            <th scope="col" className="ledger__num">Received</th>
            <th scope="col" className="ledger__num">Balance</th>
            <th scope="col">State</th>
            <th scope="col" className="ledger__action-col"><span className="ledger__sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const share = invoice.amount > 0 ? Math.min(100, Math.round((invoice.paidAmount / invoice.amount) * 100)) : 0;
            const busy = busyId === invoice.id;

            return (
              <tr key={invoice.id}>
                <td>
                  <span className="ledger__ref">{invoice.reference}</span>
                  <span className="ledger__sub">{formatDay(invoice.issuedAt ?? invoice.createdAt)}</span>
                </td>
                <td>
                  {customerPath ? (
                    <Link className="ledger__link" to={customerPath(invoice)}>{invoice.customer?.name || 'Customer'}</Link>
                  ) : (
                    <span className="ledger__strong">{invoice.customer?.name || 'Customer'}</span>
                  )}
                  <span className="ledger__sub">
                    {[invoice.vehicle?.label, invoice.vehicle?.registration].filter(Boolean).join(' · ')
                      || invoice.job?.reference
                      || 'No vehicle recorded'}
                  </span>
                </td>
                <td className="ledger__num">
                  <span className="ledger__money">{formatMoney(invoice.amount, invoice.currency)}</span>
                  {invoice.packageName ? <span className="ledger__sub">{invoice.packageName}</span> : null}
                </td>
                <td className="ledger__num">
                  <span className="ledger__settle">
                    <span className="ledger__track" role="presentation">
                      <span className="ledger__fill" data-complete={share >= 100} style={{ width: `${share}%` }} />
                    </span>
                    <span className="ledger__money ledger__money--soft">{formatMoney(invoice.paidAmount, invoice.currency)}</span>
                  </span>
                </td>
                <td className="ledger__num">
                  <span className={`ledger__money${invoice.balance > 0 ? '' : ' ledger__money--done'}`}>
                    {formatMoney(invoice.balance, invoice.currency)}
                  </span>
                </td>
                <td><InvoiceStateTag invoice={invoice} /></td>
                <td className="ledger__action-col">
                  {invoice.status === 'draft' && onIssue ? (
                    <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => onIssue(invoice)}>
                      {busy ? 'Issuing…' : 'Issue'}
                    </button>
                  ) : null}
                  {invoice.status === 'issued' && invoice.balance > 0 && onPay ? (
                    <button type="button" className="btn btn--outline btn--small" disabled={busy} onClick={() => onPay(invoice)}>
                      Record payment
                    </button>
                  ) : null}
                  {invoice.status === 'issued' && invoice.balance <= 0 ? (
                    <span className="ledger__closed">Settled</span>
                  ) : null}
                  {invoice.status === 'cancelled' ? <span className="ledger__closed">—</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
