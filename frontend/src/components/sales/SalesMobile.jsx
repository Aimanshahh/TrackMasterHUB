import { useState } from 'react';
import { Link } from 'react-router-dom';

import SaleCancel from './SaleCancel.jsx';
import { APPROVAL_TEXT, callLink, formatDay, formatMoney, renewalText, whatsappLink } from './salesHelpers.js';

function CustomerName({ row, customerLink }) {
  const name = row.customerName || 'Customer';
  return row.customerId && customerLink
    ? <Link className="sm-name" to={customerLink(row.customerId)}>{name}</Link>
    : <span className="sm-name">{name}</span>;
}

function Empty({ title, children }) {
  return (
    <div className="sm-empty">
      <span className="sm-empty__mark" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function RenewalCard({ row, customerLink }) {
  const call = callLink(row.phone);
  const chat = whatsappLink(row.phone);
  return (
    <article className="sm-card sm-card--renewal" data-state={row.state}>
      <header className="sm-card__head">
        <div className="sm-card__who">
          <CustomerName row={row} customerLink={customerLink} />
          <span className="sm-plate">{row.registration || 'No VRN'}</span>
        </div>
        <span className="sm-pill" data-tone={row.state === 'expired' ? 'bad' : 'warn'}>{renewalText(row)}</span>
      </header>
      <p className="sm-meta">Plan {row.state === 'expired' ? 'ended' : 'ends'} {formatDay(row.expiresAt)}</p>
      {row.phone ? <p className="sm-phone">{row.phone}</p> : null}
      {call || chat ? (
        <div className="sm-actions">
          {call ? <a className="sm-btn sm-btn--call" href={call}>Call</a> : null}
          {chat ? <a className="sm-btn sm-btn--chat" href={chat} target="_blank" rel="noreferrer">WhatsApp</a> : null}
        </div>
      ) : null}
    </article>
  );
}

function SaleCard({ row, customerLink, company, onChanged }) {
  return (
    <article className="sm-card">
      <header className="sm-card__head">
        <div className="sm-card__who">
          <CustomerName row={row} customerLink={customerLink} />
          <span className="sm-meta">
            <span className="sm-plate">{row.registration || 'No VRN'}</span>
            {row.packageName ? ` ${row.packageName}` : ''}
          </span>
        </div>
        {row.quotedPrice !== undefined ? (
          <div className="sm-price">
            <strong>{formatMoney(row.quotedPrice)}</strong>
            {row.discount > 0 ? <small>{formatMoney(row.discount)} below list</small> : null}
          </div>
        ) : null}
      </header>
      {row.cancellation ? (
        <p className="sm-hold__why"><strong>{row.cancellation.reasonLabel}</strong>{row.cancellation.note ? ` · ${row.cancellation.note}` : ''}<br /><span className="sm-meta">Cancelled on {formatDay(row.cancellation.cancelledAt)}{row.cancellation.cancelledBy ? ` · ${row.cancellation.cancelledBy}` : ''}</span></p>
      ) : null}
      <footer className="sm-card__foot">
        <span className="sm-pill" data-tone={row.approvalStatus === 'pending' ? 'warn' : row.approvalStatus === 'rejected' ? 'bad' : row.approvalStatus === 'approved' ? 'good' : 'plain'}>
          {APPROVAL_TEXT[row.approvalStatus] ?? row.approvalStatus}
        </span>
        <span className="sm-meta">{row.statusLabel} · {formatDay(row.createdAt)}{company && row.salesperson ? ` · ${row.salesperson}` : ''}</span>
      </footer>
      <SaleCancel row={row} onChanged={onChanged} />
    </article>
  );
}

/**
 * The phone layout of Sales: one headline number, two quick chips, then one
 * list at a time behind big tabs. Built for thumbs, and for the Android app.
 */
export default function SalesMobile({ board, mode, customerLink, approvalsLink, packages, onChanged }) {
  const company = mode === 'company';
  const { totals } = board;
  const tabs = company
    ? [['sales', 'Sales', board.recent.length], ['cancelled', 'Cancelled', board.cancelled?.length ?? 0], ['team', 'Team', board.bySalesperson?.length ?? 0], ['renewals', 'Renewals', board.renewals.length]]
    : [['renewals', 'Renewals', board.renewals.length], ['sales', 'Installations', board.recent.length], ['cancelled', 'Cancelled', board.cancelled?.length ?? 0], ['prices', 'Prices', packages.rows.length]];
  const [tab, setTab] = useState(!company && totals.renewalsDue === 0 ? 'sales' : tabs[0][0]);

  return (
    <div className="sm">
      <section className="sm-hero" aria-label="This month">
        <p className="sm-hero__label">{company ? 'Company sales this month' : 'Your installations this month'}</p>
        <p className="sm-hero__value">{company ? formatMoney(totals.monthValue) : totals.monthSales}</p>
        <p className="sm-hero__sub">
          {company ? <><strong>{totals.monthSales}</strong> {totals.monthSales === 1 ? 'sale' : 'sales'} this month · </> : null}
          <strong>{totals.sales}</strong> {company ? 'in total' : 'installations in total'}
        </p>
        <div className="sm-hero__chips">
          {approvalsLink
            ? <Link className="sm-chip" data-tone={totals.awaitingApproval ? 'warn' : 'plain'} to={approvalsLink}><strong>{totals.awaitingApproval}</strong> awaiting approval</Link>
            : <span className="sm-chip" data-tone={totals.awaitingApproval ? 'warn' : 'plain'}><strong>{totals.awaitingApproval}</strong> awaiting approval</span>}
          <button type="button" className="sm-chip" data-tone={totals.renewalsExpired ? 'bad' : totals.renewalsDue ? 'warn' : 'plain'} onClick={() => setTab('renewals')}>
            <strong>{totals.renewalsDue}</strong> {totals.renewalsExpired ? `renewals · ${totals.renewalsExpired} expired` : 'renewals due'}
          </button>
        </div>
      </section>

      <div className="sm-tabs" role="tablist" aria-label="Sales sections">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {label}{count ? <span>{count}</span> : null}
          </button>
        ))}
      </div>

      <div className="sm-list" role="tabpanel">
        {tab === 'renewals' ? (
          board.renewals.length === 0
            ? <Empty title="No renewals to chase">No vehicle has a yearly plan that has ended or ends in the next 30 days.</Empty>
            : board.renewals.map((row) => <RenewalCard key={row.id} row={row} customerLink={customerLink} />)
        ) : null}

        {tab === 'sales' ? (
          board.recent.length === 0
            ? <Empty title="No sales yet">{company ? 'Sales appear here as soon as one is recorded.' : 'Open a customer and choose Request installation to record your first sale.'}</Empty>
            : board.recent.map((row) => <SaleCard key={row.id} row={row} customerLink={customerLink} company={company} onChanged={onChanged} />)
        ) : null}

        {tab === 'cancelled' ? (
          (board.cancelled ?? []).length === 0
            ? <Empty title="No cancelled sales">A cancelled sale is kept here with the reason, so you can see why it fell through.</Empty>
            : board.cancelled.map((row) => <SaleCard key={row.id} row={row} customerLink={customerLink} company={company} onChanged={onChanged} />)
        ) : null}

        {tab === 'team' ? (
          (board.bySalesperson ?? []).map((row, index) => (
            <article key={row.id} className="sm-card sm-card--team">
              <span className="sm-rank">{index + 1}</span>
              <div className="sm-card__who"><span className="sm-name">{row.name}</span><span className="sm-meta">{row.monthSales} this month · {row.sales} in total</span></div>
              <div className="sm-price"><strong>{formatMoney(row.monthValue)}</strong><small>this month</small></div>
            </article>
          ))
        ) : null}

        {tab === 'prices' ? (
          packages.rows.length === 0
            ? <Empty title="No prices yet">The admin has not set package prices.</Empty>
            : packages.rows.map((item) => (
              <article key={item.key} className="sm-card sm-card--price">
                <div className="sm-card__who"><span className="sm-name">{item.name}</span><span className="sm-meta">{item.summary}</span></div>
                <div className="sm-price"><strong>{item.price === null || item.price === undefined ? 'Not set' : formatMoney(item.price, packages.currency)}</strong></div>
              </article>
            ))
        ) : null}
      </div>
    </div>
  );
}
