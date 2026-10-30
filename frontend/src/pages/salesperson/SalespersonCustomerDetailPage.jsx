import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { formatDay, formatDayTime } from '../../app/operations.js';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import ComplaintDrawer from '../../components/salesperson/ComplaintDrawer.jsx';
import CustomerAvatar from '../../components/salesperson/CustomerAvatar.jsx';
import RequestDrawer from '../../components/salesperson/RequestDrawer.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useMyJobs } from '../../hooks/useSalesperson.js';
import { fetchComplaints, fetchCustomer, updateCustomer } from '../../lib/api.js';

const priorityLabel = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

export default function SalespersonCustomerDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useDocumentTitle(customer?.name ?? 'Customer record');

  const jobs = useMyJobs();
  const [complaints, setComplaints] = useState([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const [followUp, setFollowUp] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchCustomer(customerId);
      setCustomer(payload.data.customer);
      setComplaints((await fetchComplaints({ limit: 50 })).data.filter((ticket) => ticket.customer === customerId || ticket.customerId === customerId));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);

  const myJobs = jobs.rows.filter((job) => job.customer === customerId);

  async function logFollowUp(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
    const nextNotes = note.trim()
      ? `${customer.notes ? `${customer.notes}\n\n` : ''}${stamp} — ${note.trim()}`
      : customer.notes ?? '';

    try {
      const payload = await updateCustomer(customerId, {
        followUp: followUp || null,
        notes: nextNotes,
      });
      setCustomer(payload.data.customer);
      setNote('');
      setFollowUp('');
      setSaved(true);
    } catch (saveFailure) {
      setSaveError(saveFailure.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="data-state" role="status">Loading customer record…</p>;
  if (error) return <div className="sp-customer"><p className="app-notice app-notice--error" role="alert">{error}</p><button type="button" className="btn btn--outline btn--small" onClick={() => navigate('/salesperson/customers')}>Back to customers</button></div>;
  if (!customer) return null;

  return (
    <div className="sp-customer">
      <nav className="sp-back"><Link to="/salesperson/customers">← My customers</Link></nav>

      <header className="sp-customer__head">
        <div className="sp-customer__id">
          <CustomerAvatar name={customer.name} tone={customer.priority} size="lg" />
          <div>
            <p className="drawer__eyebrow">{customer.category || 'Customer'}{customer.company ? ` · ${customer.company}` : ''}</p>
            <h2>{customer.name}</h2>
            <p className="sp-customer__contact">
              {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : 'No phone recorded'}
              {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : null}
            </p>
          </div>
        </div>
        <div className="sp-customer__actions">
          <button type="button" className="btn btn--primary" onClick={() => setRequestOpen(true)}>New installation</button>
          <button type="button" className="btn btn--outline" onClick={() => setComplaintOpen(true)}>Log complaint</button>
        </div>
      </header>

      <div className="sp-customer__grid">
        <section className="sp-block">
          <header className="sp-block__head"><h3>Profile</h3><span className="sp-priority" data-tone={customer.priority}>{priorityLabel[customer.priority] ?? customer.priority}</span></header>
          <dl className="sp-facts">
            <div><dt>Phone</dt><dd>{customer.phone || '—'}</dd></div>
            <div><dt>Email</dt><dd>{customer.email || '—'}</dd></div>
            <div><dt>Business</dt><dd>{customer.company || '—'}</dd></div>
            <div><dt>Category</dt><dd>{customer.category || '—'}</dd></div>
            <div><dt>Owner</dt><dd>{customer.owner?.name ?? 'You'}</dd></div>
            <div><dt>Added</dt><dd>{formatDay(customer.createdAt)}</dd></div>
            <div><dt>Next follow-up</dt><dd>{formatDay(customer.followUp)}</dd></div>
          </dl>
        </section>

        <section className="sp-block">
          <header className="sp-block__head"><h3>Log a follow-up</h3></header>
          <form className="sp-form" onSubmit={logFollowUp}>
            <label className="field">
              <span className="field__label">Next follow-up date</span>
              <input className="input" type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">What was discussed</span>
              <textarea className="input input--area" rows={3} maxLength={1200} placeholder="Call outcome, next action, customer response…" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {saveError ? <p className="form-alert" role="alert">{saveError}</p> : null}
            {saved ? <p className="form-notice" role="status">Follow-up saved to this record.</p> : null}
            <button type="submit" className="btn btn--primary btn--small" disabled={saving || (!followUp && !note.trim())}>
              {saving ? 'Saving…' : 'Save follow-up'}
            </button>
          </form>
        </section>
      </div>

      <section className="sp-block">
        <header className="sp-block__head"><h3>Requests for this customer</h3><Link className="panel__link" to="/salesperson/requests">All requests</Link></header>
        {myJobs.length === 0 ? (
          <div className="app-empty sp-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>No requests yet</h2>
            <p>Send a new installation and operations will pick it up from the queue.</p>
          </div>
        ) : (
          <ul className="sp-request-list">
            {myJobs.map((job) => (
              <li key={job.id}>
                <div className="sp-request-list__main">
                  <span className="sp-ref">{job.reference}</span>
                  <strong>{[job.vehicle.label, job.vehicle.registration].filter(Boolean).join(' · ') || 'Follow-up contact'}</strong>
                  <span>
                    {[
                      job.vehicle.station,
                      job.scheduledAt ? formatDayTime(job.scheduledAt) : 'No slot requested',
                      job.technician?.name && `Technician ${job.technician.name}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <StatusPill status={job.status} label={job.statusLabel} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sp-block">
        <header className="sp-block__head"><h3>Complaints</h3><Link className="panel__link" to="/salesperson/complaints">All tickets</Link></header>
        {complaints.length === 0 ? (
          <div className="app-empty sp-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>No complaints logged</h2>
            <p>Log a complaint here and it goes straight to the operations queue.</p>
          </div>
        ) : (
          <ul className="sp-ticket-list">
            {complaints.map((ticket) => (
              <li key={ticket.id}>
                <div>
                  <span className="sp-ref">{ticket.reference}</span>
                  <strong>{ticket.title}</strong>
                  <span>{ticket.category} · {formatDay(ticket.createdAt)}</span>
                </div>
                <StatusPill status={ticket.status} label={ticket.statusLabel} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sp-block">
        <header className="sp-block__head"><h3>Notes</h3></header>
        {customer.notes ? <p className="sp-notes">{customer.notes}</p> : <p className="sp-block__meta">No notes recorded yet.</p>}
      </section>

      <RequestDrawer open={requestOpen} customer={customer} onClose={() => setRequestOpen(false)} onSaved={jobs.refresh} />
      <ComplaintDrawer open={complaintOpen} customers={[customer]} defaultCustomerId={customer.id} onClose={() => setComplaintOpen(false)} onSaved={loadCustomer} />
    </div>
  );
}
