import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchPackages } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';

const APPROVAL_TEXT = {
  not_required: 'Standard price',
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatDay(value) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
}

function renewalText(row) {
  if (row.state === 'expired') return `Expired ${Math.abs(row.daysLeft)} ${Math.abs(row.daysLeft) === 1 ? 'day' : 'days'} ago`;
  return row.daysLeft === 0 ? 'Expires today' : `Expires in ${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'}`;
}

/** Package rates, so a salesperson can quote without leaving the page. */
function PriceList() {
  const [state, setState] = useState({ rows: [], currency: 'PKR' });
  useEffect(() => {
    const controller = new AbortController();
    fetchPackages({ signal: controller.signal })
      .then((payload) => setState({ rows: payload.data ?? [], currency: payload.meta?.currency ?? 'PKR' }))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (state.rows.length === 0) return null;
  return (
    <section className="wa-card">
      <header className="wa-card__head"><h2>Price list</h2></header>
      <div className="ledger-wrap">
        <table className="ledger">
          <thead><tr><th>Package</th><th>What it covers</th><th>Price</th></tr></thead>
          <tbody>
            {state.rows.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.name}</strong></td>
                <td className="sales-muted">{item.summary}</td>
                <td>{item.price === null || item.price === undefined ? <span className="sales-muted">Not set yet</span> : formatMoney(item.price, state.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Sales and renewals in one place. mode "mine" is a salesperson's own figures;
 * mode "company" is the admin and manager view across everyone.
 */
export default function SalesBoard({ board, mode, customerLink, approvalsLink }) {
  const company = mode === 'company';
  const { totals } = board;

  const tiles = [
    { label: 'Sales this month', value: totals.monthSales, note: formatMoney(totals.monthValue) },
    { label: 'All sales', value: totals.sales, note: formatMoney(totals.salesValue) },
    { label: 'Awaiting price approval', value: totals.awaitingApproval, note: approvalsLink ? 'Open approvals' : 'Admin decides', to: approvalsLink, attention: totals.awaitingApproval > 0 },
    { label: 'Renewals due', value: totals.renewalsDue, note: totals.renewalsExpired ? `${totals.renewalsExpired} already expired` : 'Within 30 days', attention: totals.renewalsExpired > 0 },
  ];

  return (
    <div className="sales-board">
      <section className="ops-home__tiles" aria-label="Sales at a glance">
        {tiles.map((tile) => {
          const body = (<><span>{tile.label}</span><strong>{tile.value}</strong><small>{tile.note}</small></>);
          return tile.to
            ? <Link key={tile.label} to={tile.to} className="ops-home__tile" data-tone={tile.attention ? 'attention' : ''}>{body}</Link>
            : <div key={tile.label} className="ops-home__tile" data-tone={tile.attention ? 'attention' : ''}>{body}</div>;
        })}
      </section>

      {company && board.bySalesperson?.length ? (
        <section className="wa-card">
          <header className="wa-card__head"><h2>By salesperson</h2></header>
          <div className="ledger-wrap">
            <table className="ledger">
              <thead><tr><th>Salesperson</th><th>This month</th><th>Value this month</th><th>All sales</th><th>All-time value</th></tr></thead>
              <tbody>
                {board.bySalesperson.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.monthSales}</td>
                    <td>{formatMoney(row.monthValue)}</td>
                    <td>{row.sales}</td>
                    <td>{formatMoney(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="wa-card">
        <header className="wa-card__head"><h2>{company ? 'Latest sales' : 'My latest sales'}</h2></header>
        {board.recent.length === 0 ? (
          <p className="panel__note">{company ? 'No sale has been recorded yet.' : 'You have not recorded a sale yet. Start one from a customer using Request installation.'}</p>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Package</th><th>Price</th><th>Approval</th><th>Progress</th>{company ? <th>Salesperson</th> : null}</tr>
              </thead>
              <tbody>
                {board.recent.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDay(row.createdAt)}</td>
                    <td>{row.customerId && customerLink ? <Link to={customerLink(row.customerId)}><strong>{row.customerName || 'Customer'}</strong></Link> : <strong>{row.customerName || 'Customer'}</strong>}</td>
                    <td className="mono">{row.registration || '—'}</td>
                    <td>{row.packageName || '—'}</td>
                    <td>
                      {formatMoney(row.quotedPrice)}
                      {row.discount > 0 ? <small className="sales-muted sales-block">{formatMoney(row.discount)} below list</small> : null}
                    </td>
                    <td><span className="sales-pill" data-tone={row.approvalStatus}>{APPROVAL_TEXT[row.approvalStatus] ?? row.approvalStatus}</span></td>
                    <td>{row.statusLabel}</td>
                    {company ? <td>{row.salesperson || '—'}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="wa-card">
        <header className="wa-card__head"><h2>Renewals to follow up</h2></header>
        {board.renewals.length === 0 ? (
          <p className="panel__note">No vehicle has a yearly plan that expired or expires in the next 30 days.</p>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead><tr><th>Customer</th><th>Phone</th><th>Vehicle</th><th>Plan ends</th><th>Status</th></tr></thead>
              <tbody>
                {board.renewals.map((row) => (
                  <tr key={row.id}>
                    <td>{row.customerId && customerLink ? <Link to={customerLink(row.customerId)}><strong>{row.customerName || 'Customer'}</strong></Link> : <strong>{row.customerName || 'Customer'}</strong>}</td>
                    <td className="mono">{row.phone || '—'}</td>
                    <td className="mono">{row.registration || '—'}</td>
                    <td>{formatDay(row.expiresAt)}</td>
                    <td><span className="sales-pill" data-tone={row.state === 'expired' ? 'rejected' : 'pending'}>{renewalText(row)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!company ? <PriceList /> : null}
    </div>
  );
}
