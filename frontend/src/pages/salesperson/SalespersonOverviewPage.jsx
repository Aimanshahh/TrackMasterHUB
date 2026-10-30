import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useSalespersonSummary } from '../../hooks/useSalesperson.js';
import IntakeDrawer from '../../components/salesperson/IntakeDrawer.jsx';
import ComplaintDrawer from '../../components/salesperson/ComplaintDrawer.jsx';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import { formatDay, formatDayTime } from '../../app/operations.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SalespersonOverviewPage() {
  useDocumentTitle('My day');
  const { user } = useAuth();
  const summary = useSalespersonSummary();
  const notifications = useNotifications();
  const customers = useCustomers({ limit: 100 });
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const data = summary.data;
  const displayName = (user?.name ?? '').trim() || 'there';

  const metrics = [
    { label: 'My customers', value: data?.customers?.total, note: 'records', to: '/salesperson/customers' },
    { label: 'Follow-ups due', value: data?.customers?.followUpsDue, note: 'date has passed', to: '/salesperson/follow-ups' },
    { label: 'Open requests', value: data?.requests?.open, note: 'with operations', to: '/salesperson/requests' },
    { label: 'Open tickets', value: data?.complaints?.open, note: 'awaiting resolution', to: '/salesperson/complaints' },
  ];

  return (
    <div className="sp-day">
      <section className="sp-hero">
        <div>
          <p className="sp-hero__hello">
            <span>{greeting()}, {displayName}.</span>
            <span className="sp-hero__date">
              {new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}
            </span>
          </p>
          <h2>Here is your desk for today.</h2>
          <p>
            {data
              ? data.customers.total === 0
                ? 'Add your first customer — the record is assigned to you and appears here immediately.'
                : `${data.customers.followUpsWeek} follow-up${data.customers.followUpsWeek === 1 ? '' : 's'} scheduled this week and ${data.requests.open} request${data.requests.open === 1 ? '' : 's'} in operations.`
              : 'Loading your portfolio…'}
          </p>
        </div>
        <div className="sp-hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => setIntakeOpen(true)}>Add customer</button>
          <button type="button" className="btn btn--outline" onClick={() => setComplaintOpen(true)}>Log complaint</button>
        </div>
      </section>

      {summary.error ? <p className="app-notice app-notice--error" role="alert">Your desk data is unavailable: {summary.error}</p> : null}

      <section className="sp-metrics" aria-label="Your numbers">
        {metrics.map((metric) => (
          <Link className="sp-metric" key={metric.label} to={metric.to}>
            <span className="sp-metric__label">{metric.label}</span>
            <strong>{metric.value === undefined || metric.value === null ? '—' : metric.value}</strong>
            <small>{metric.note}</small>
          </Link>
        ))}
      </section>

      <div className="sp-split">
        <section className="sp-block">
          <header className="sp-block__head">
            <h3>Needs you next</h3>
            <Link to="/salesperson/follow-ups" className="panel__link">All follow-ups</Link>
          </header>

          {summary.status === 'loading' ? <p className="data-state">Reading your portfolio…</p> : null}

          {data && data.followUps.length === 0 ? (
            <div className="app-empty sp-empty">
              <span className="app-empty__mark" aria-hidden="true">—</span>
              <h2>Nothing is overdue</h2>
              <p>Set a follow-up date on a customer and it will surface here on the day.</p>
            </div>
          ) : null}

          {data && data.followUps.length > 0 ? (
            <ul className="sp-attention">
              {data.followUps.map((customer) => {
                const overdue = customer.followUp && new Date(customer.followUp) < new Date(new Date().toDateString());
                return (
                  <li key={customer.id}>
                    <span className={`sp-attention__date${overdue ? ' is-overdue' : ''}`}>
                      {customer.followUp ? formatDay(customer.followUp) : '—'}
                    </span>
                    <div className="sp-attention__body">
                      <Link to={`/salesperson/customers/${customer.id}`}><strong>{customer.name}</strong></Link>
                      <span>{[customer.company, customer.phone].filter(Boolean).join(' · ') || 'No phone recorded'}</span>
                    </div>
                    {customer.phone ? <a className="sp-call" href={`tel:${customer.phone}`} aria-label={`Call ${customer.name}`}>Call</a> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="sp-block">
          <header className="sp-block__head">
            <h3>Latest updates</h3>
            <span className="sp-block__meta">{notifications.unread > 0 ? `${notifications.unread} unread` : 'All caught up'}</span>
          </header>

          {notifications.error ? <p className="app-notice app-notice--error" role="alert">Updates are unavailable right now.</p> : null}

          {!notifications.error && notifications.rows.length === 0 ? (
            <div className="app-empty sp-empty">
              <span className="app-empty__mark" aria-hidden="true">—</span>
              <h2>No status changes yet</h2>
              <p>When operations moves one of your requests or tickets, the update lands here.</p>
            </div>
          ) : null}

          {notifications.rows.length > 0 ? (
            <ul className="sp-updates">
              {notifications.rows.slice(0, 6).map((notification) => (
                <li key={notification.id} className={notification.read ? '' : 'is-unread'}>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <time>{formatDayTime(notification.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="sp-block">
        <header className="sp-block__head">
          <h3>Your requests in operations</h3>
          <Link to="/salesperson/requests" className="panel__link">All requests</Link>
        </header>

        {data && data.recentJobs.length === 0 ? (
          <div className="app-empty sp-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>No installation requests yet</h2>
            <p>Add a customer with the new installation option and the request appears in the operations queue.</p>
          </div>
        ) : null}

        {data && data.recentJobs.length > 0 ? (
          <ul className="sp-request-list">
            {data.recentJobs.map((job) => (
              <li key={job.id}>
                <div className="sp-request-list__main">
                  <span className="sp-ref">{job.reference}</span>
                  <strong>{job.customerName || 'Customer'}</strong>
                  <span>{[job.vehicle.label, job.vehicle.registration, job.vehicle.station].filter(Boolean).join(' · ') || 'Follow-up contact'}</span>
                </div>
                <StatusPill status={job.status} label={job.statusLabel} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <IntakeDrawer open={intakeOpen} onClose={() => setIntakeOpen(false)} onSaved={() => { summary.refresh(); }} />
      <ComplaintDrawer open={complaintOpen} customers={customers.rows} onClose={() => setComplaintOpen(false)} onSaved={() => { summary.refresh(); notifications.refresh(); }} />
    </div>
  );
}
