import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { formatDay } from '../../app/operations.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bucketFor(value) {
  if (!value) return 'unscheduled';
  const due = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const diff = Math.round((due - today) / 86_400_000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'week';
  return 'later';
}

const GROUPS = [
  { key: 'overdue', title: 'Overdue', note: 'The date has passed — call first.' },
  { key: 'today', title: 'Today', note: 'Scheduled for today.' },
  { key: 'week', title: 'Next seven days', note: 'Coming up this week.' },
  { key: 'later', title: 'Later', note: 'Further ahead.' },
  { key: 'unscheduled', title: 'No date set', note: 'Add a follow-up date from the customer record.' },
];

export default function SalespersonFollowUpsPage() {
  useDocumentTitle('Follow-ups');
  const customers = useCustomers({ sort: 'followUp', direction: 'asc', limit: 100 });

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(GROUPS.map((group) => [group.key, []]));
    for (const customer of customers.rows) buckets[bucketFor(customer.followUp)].push(customer);
    return buckets;
  }, [customers.rows]);

  const dueNow = (grouped.overdue?.length ?? 0) + (grouped.today?.length ?? 0);

  return (
    <div className="sp-followups">
      <section className="sp-summary-line">
        <div>
          <strong>{dueNow}</strong>
          <span>customer{dueNow === 1 ? '' : 's'} need contact today</span>
        </div>
        <button type="button" className="sp-text-btn" onClick={customers.refresh}>{customers.isFetching ? 'Refreshing…' : 'Refresh'}</button>
      </section>

      {customers.error ? <p className="app-notice app-notice--error" role="alert">{customers.error}</p> : null}
      {customers.status === 'loading' ? <p className="data-state" role="status">Loading follow-up plan…</p> : null}

      {customers.status !== 'loading' && customers.rows.length === 0 ? (
        <div className="app-empty sp-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>No follow-ups to plan</h2>
          <p>Follow-ups come from the dates you set on your customers. Nothing is generated for you.</p>
        </div>
      ) : null}

      {customers.rows.length > 0 ? GROUPS.map((group) => {
        const rows = grouped[group.key];
        if (!rows.length) return null;
        return (
          <section className="sp-block" key={group.key}>
            <header className="sp-block__head">
              <h3>{group.title}</h3>
              <span className="sp-block__meta">{rows.length} · {group.note}</span>
            </header>
            <ul className="sp-followup-list">
              {rows.map((customer) => (
                <li key={customer.id}>
                  <div className="sp-followup-list__date">
                    <span>{customer.followUp ? formatDay(customer.followUp) : '—'}</span>
                    <small>{group.key === 'overdue' ? 'Late' : group.key === 'today' ? 'Today' : ''}</small>
                  </div>
                  <div className="sp-followup-list__body">
                    <Link to={`/salesperson/customers/${customer.id}`}><strong>{customer.name}</strong></Link>
                    <span>{[customer.company, customer.phone, customer.category].filter(Boolean).join(' · ') || 'No contact details'}</span>
                  </div>
                  <div className="sp-followup-list__actions">
                    {customer.phone ? <a className="sp-call" href={`tel:${customer.phone}`}>Call</a> : null}
                    <Link to={`/salesperson/customers/${customer.id}`} className="sp-open">Open</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      }) : null}
    </div>
  );
}
