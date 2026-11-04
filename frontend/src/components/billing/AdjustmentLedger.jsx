import { Link } from 'react-router-dom';

import { formatMoney } from '../../lib/format.js';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/** Credit notes and refunds, newest first, each with a printable document. */
export default function AdjustmentLedger({ adjustments }) {
  if (!adjustments?.length) return null;

  return (
    <div className="ledger-scroll">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Invoice</th>
            <th scope="col">Reason</th>
            <th scope="col" className="ledger__num">Amount</th>
            <th scope="col" className="ledger__action-col"><span className="ledger__sr">Print</span></th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="ledger__ref">{row.reference}</span>
                <span className="ledger__sub">{row.kindLabel} · {formatDay(row.issuedAt)}</span>
              </td>
              <td><span className="ledger__muted">{row.invoice.reference}</span></td>
              <td>
                <span className="ledger__muted">{row.reason}</span>
                {row.kind === 'refund' && row.methodLabel ? <span className="ledger__sub">{row.methodLabel}{row.transactionRef ? ` · ${row.transactionRef}` : ''}</span> : null}
              </td>
              <td className="ledger__num">
                <span className="ledger__money">{row.kind === 'credit_note' ? '−' : ''}{formatMoney(row.amount, row.currency)}</span>
              </td>
              <td className="ledger__action-col">
                <Link className="ledger__open" to={`/adjustments/${row.id}/print`} target="_blank" rel="noopener noreferrer">Print</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
