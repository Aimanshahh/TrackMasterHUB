import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchPackages } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import SaleHold from './SaleHold.jsx';
import SalesMobile from './SalesMobile.jsx';
import { APPROVAL_TEXT, callLink, formatDay, renewalText, whatsappLink } from './salesHelpers.js';
import { useMediaQuery } from './useMediaQuery.js';

/** Package rates, so a salesperson can quote without leaving the page. */
function PriceList({ state }) {
  if (state.rows.length === 0) return null;
  return (
    <section className="wa-card">
      <header className="wa-card__head"><h2>Price list</h2></header>
      <div className="ledger-wrap">
        <table className="ledger ledger--stack">
          <thead><tr><th>Package</th><th>What it covers</th><th>Price</th></tr></thead>
          <tbody>
            {state.rows.map((item) => (
              <tr key={item.key}>
                <td data-label="Package"><strong>{item.name}</strong></td>
                <td data-label="Covers" className="sales-muted">{item.summary}</td>
                <td data-label="Price">{item.price === null || item.price === undefined ? <span className="sales-muted">Not set yet</span> : formatMoney(item.price, state.currency)}</td>
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
export default function SalesBoard({ board, mode, customerLink, approvalsLink, onChanged }) {
  const company = mode === 'company';
  const phone = useMediaQuery('(max-width: 720px)');
  const [packages, setPackages] = useState({ rows: [], currency: 'PKR' });

  useEffect(() => {
    if (company) return undefined;
    const controller = new AbortController();
    fetchPackages({ signal: controller.signal })
      .then((payload) => setPackages({ rows: payload.data ?? [], currency: payload.meta?.currency ?? 'PKR' }))
      .catch(() => {});
    return () => controller.abort();
  }, [company]);

  if (phone || !company) return <SalesMobile board={board} mode={mode} customerLink={customerLink} approvalsLink={approvalsLink} packages={packages} onChanged={onChanged} />;

  const { totals } = board;

  const tiles = [
    { label: company ? 'Sales this month' : 'Installations this month', value: totals.monthSales, note: company ? formatMoney(totals.monthValue) : 'Since the 1st' },
    { label: company ? 'All sales' : 'All installations', value: totals.sales, note: company ? formatMoney(totals.salesValue) : 'Active, not on hold' },
    { label: 'On hold', value: totals.suspended ?? 0, note: 'Waiting on the customer', attention: false },
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
            <table className="ledger ledger--stack">
              <thead><tr><th>Salesperson</th><th>This month</th><th>Value this month</th><th>All sales</th><th>All-time value</th></tr></thead>
              <tbody>
                {board.bySalesperson.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Salesperson"><strong>{row.name}</strong></td>
                    <td data-label="This month">{row.monthSales}</td>
                    <td data-label="Value this month">{formatMoney(row.monthValue)}</td>
                    <td data-label="All sales">{row.sales}</td>
                    <td data-label="All-time value">{formatMoney(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="wa-card">
        <header className="wa-card__head"><h2>Sales on hold</h2></header>
        {(board.suspended ?? []).length === 0 ? (
          <p className="panel__note">Nothing is on hold. A sale you put on hold is kept here with the reason until it is resumed.</p>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger ledger--stack">
              <thead><tr><th>Customer</th><th>Vehicle</th><th>Reason</th><th>On hold since</th>{company ? <th>Salesperson</th> : null}<th>Hold</th></tr></thead>
              <tbody>
                {board.suspended.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer">{row.customerId && customerLink ? <Link to={customerLink(row.customerId)}><strong>{row.customerName || 'Customer'}</strong></Link> : <strong>{row.customerName || 'Customer'}</strong>}</td>
                    <td data-label="Vehicle" className="mono">{row.registration || '—'}</td>
                    <td data-label="Reason">{row.suspension.reasonLabel}{row.suspension.note ? <small className="sales-muted sales-block">{row.suspension.note}</small> : null}</td>
                    <td data-label="On hold since">{formatDay(row.suspension.suspendedAt)}</td>
                    {company ? <td data-label="Salesperson">{row.salesperson || '—'}</td> : null}
                    <td data-label="Hold"><SaleHold row={row} onChanged={onChanged} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="wa-card">
        <header className="wa-card__head"><h2>{company ? 'Latest sales' : 'My latest installations'}</h2></header>
        {board.recent.length === 0 ? (
          <p className="panel__note">{company ? 'No sale has been recorded yet.' : 'You have not recorded a sale yet. Start one from a customer using Request installation.'}</p>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger ledger--stack">
              <thead>
                <tr><th>Customer</th><th>Date</th><th>Vehicle</th><th>Package</th>{company ? <th>Price</th> : null}<th>Approval</th><th>Progress</th>{company ? <th>Salesperson</th> : null}</tr>
              </thead>
              <tbody>
                {board.recent.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer">{row.customerId && customerLink ? <Link to={customerLink(row.customerId)}><strong>{row.customerName || 'Customer'}</strong></Link> : <strong>{row.customerName || 'Customer'}</strong>}</td>
                    <td data-label="Date">{formatDay(row.createdAt)}</td>
                    <td data-label="Vehicle" className="mono">{row.registration || '—'}</td>
                    <td data-label="Package">{row.packageName || '—'}</td>
                    {company ? (
                      <td data-label="Price">
                        {formatMoney(row.quotedPrice)}
                        {row.discount > 0 ? <small className="sales-muted sales-block">{formatMoney(row.discount)} below list</small> : null}
                      </td>
                    ) : null}
                    <td data-label="Approval"><span className="sales-pill" data-tone={row.approvalStatus}>{APPROVAL_TEXT[row.approvalStatus] ?? row.approvalStatus}</span></td>
                    <td data-label="Progress">{row.statusLabel}</td>
                    {company ? <td data-label="Salesperson">{row.salesperson || '—'}</td> : null}
                    <td data-label="Hold"><SaleHold row={row} onChanged={onChanged} /></td>
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
            <table className="ledger ledger--stack">
              <thead><tr><th>Customer</th><th>Phone</th><th>Vehicle</th><th>Plan ends</th><th>Status</th><th>Contact</th></tr></thead>
              <tbody>
                {board.renewals.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer">{row.customerId && customerLink ? <Link to={customerLink(row.customerId)}><strong>{row.customerName || 'Customer'}</strong></Link> : <strong>{row.customerName || 'Customer'}</strong>}</td>
                    <td data-label="Phone" className="mono">{row.phone || '—'}</td>
                    <td data-label="Vehicle" className="mono">{row.registration || '—'}</td>
                    <td data-label="Plan ends">{formatDay(row.expiresAt)}</td>
                    <td data-label="Status"><span className="sales-pill" data-tone={row.state === 'expired' ? 'rejected' : 'pending'}>{renewalText(row)}</span></td>
                    <td data-label="Contact">
                      <span className="sales-contact">
                        {callLink(row.phone) ? <a className="btn btn--outline btn--small" href={callLink(row.phone)}>Call</a> : null}
                        {whatsappLink(row.phone) ? <a className="btn btn--outline btn--small" href={whatsappLink(row.phone)} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!company ? <PriceList state={packages} /> : null}
    </div>
  );
}
