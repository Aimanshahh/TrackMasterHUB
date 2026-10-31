import { formatMoney } from '../../lib/format.js';

function formatDayTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

/**
 * Append-only money ledger. Each row is one instalment, so a customer who paid
 * half at installation and half later shows two dated lines against the invoice.
 */
export default function PaymentLedger({ payments, eyebrow, emptyMessage = 'No payments recorded yet.' }) {
  if (!payments.length) {
    return (
      <div className="app-empty">
        <span className="app-empty__mark" aria-hidden="true">—</span>
        <h2>No money received yet</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="ledger-scroll">
      <table className="ledger ledger--payments">
        <thead>
          <tr>
            <th scope="col">Received</th>
            <th scope="col">Customer</th>
            <th scope="col">Invoice</th>
            <th scope="col">Method</th>
            <th scope="col">Reference</th>
            <th scope="col" className="ledger__num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>
                <span className="ledger__strong">{formatDayTime(payment.receivedAt)}</span>
                <span className="ledger__sub">{payment.reference}</span>
              </td>
              <td>
                <span className="ledger__strong">{payment.customer?.name || 'Customer'}</span>
                <span className="ledger__sub">{payment.customer?.phone || '—'}</span>
              </td>
              <td><span className="ledger__ref">{payment.invoice?.reference || '—'}</span></td>
              <td><span className="ledger__strong">{payment.methodLabel}</span></td>
              <td className="ledger__muted">{payment.transactionRef || payment.note || '—'}</td>
              <td className="ledger__num">
                <span className="ledger__money">{formatMoney(payment.amount, payment.currency)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        {eyebrow ? (
          <tfoot>
            <tr>
              <td colSpan={5}>{eyebrow}</td>
              <td className="ledger__num">
                <span className="ledger__money">{formatMoney(payments.reduce((sum, payment) => sum + payment.amount, 0))}</span>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
