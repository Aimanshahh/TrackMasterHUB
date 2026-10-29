import { useState } from 'react';

import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS_OPTIONS, PRIORITY_OPTIONS, formatDayTime } from '../../app/operations.js';
import { useAuth } from '../../context/auth.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useComplaints } from '../../hooks/useOperations.js';
import { createComplaintRecord, updateComplaintRecord } from '../../lib/api.js';
import { PriorityTag, StatusPill } from './OpsStatus.jsx';

function CreateComplaintDrawer({ onClose, onCreated }) {
  const customers = useCustomers({ limit: 100 });
  const [form, setForm] = useState({ customerId: '', title: '', category: 'Installation', priority: 'normal', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createComplaintRecord(form);
      onCreated();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The ticket could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close ticket form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-complaint-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Customer care</p>
            <h2 className="drawer__title" id="create-complaint-title">Log a complaint</h2>
            <p className="drawer__subtitle">The salesperson who logs the ticket is notified when its status changes.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="drawer__section-label">Ticket</div>
          <label className="field">
            <span className="field__label">Customer record <i>Required</i></span>
            <select className="input" value={form.customerId} onChange={update('customerId')} required>
              <option value="">{customers.status === 'loading' ? 'Loading customers…' : 'Select a customer'}</option>
              {customers.rows.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
            </select>
            {customers.status === 'ready' && customers.rows.length === 0 ? <span className="field__hint">Add the customer in the register before logging a complaint.</span> : null}
          </label>

          <label className="field">
            <span className="field__label">Short title <i>Required</i></span>
            <input className="input" value={form.title} onChange={update('title')} maxLength={200} required minLength={3} placeholder="What is the issue?" />
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field__label">Category</span>
              <select className="input" value={form.category} onChange={update('category')}>
                {COMPLAINT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Priority</span>
              <select className="input" value={form.priority} onChange={update('priority')}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field__label">Details</span>
            <textarea className="input input--area" rows={4} maxLength={3000} value={form.description} onChange={update('description')} placeholder="What the customer reported, and what has been checked so far." />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Logging…' : 'Log ticket'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ComplaintDrawer({ complaint, canManage, onClose, onSaved }) {
  const [form, setForm] = useState({ status: complaint.status, assignToSelf: Boolean(complaint.assignedTo), resolution: complaint.resolution ?? '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateComplaintRecord(complaint.id, {
        status: form.status,
        assignToSelf: form.assignToSelf,
        resolution: form.resolution,
        note: form.note,
      });
      onSaved();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The ticket could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close ticket" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="complaint-drawer-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{complaint.reference} · {complaint.category}</p>
            <h2 className="drawer__title" id="complaint-drawer-title">{complaint.title}</h2>
            <p className="drawer__subtitle">{complaint.customerName} · logged {formatDayTime(complaint.createdAt)}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="ops-summary">
            <div><span>Status</span><StatusPill status={complaint.status} label={complaint.statusLabel} /></div>
            <div><span>Priority</span><PriorityTag priority={complaint.priority} /></div>
            <div><span>Logged by</span><strong>{complaint.createdBy?.name || '—'}</strong></div>
            <div><span>Owner</span><strong>{complaint.assignedTo?.name || 'Unassigned'}</strong></div>
          </div>

          {complaint.description ? <p className="ops-quote">{complaint.description}</p> : null}

          {canManage ? (
            <>
              <div className="drawer__section-label">Progress</div>
              <label className="field">
                <span className="field__label">Status</span>
                <select className="input" value={form.status} onChange={update('status')}>
                  {COMPLAINT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label className="ops-check">
                <input type="checkbox" checked={form.assignToSelf} onChange={(event) => setForm((current) => ({ ...current, assignToSelf: event.target.checked }))} />
                <span>Assign this ticket to me</span>
              </label>

              <label className="field">
                <span className="field__label">Resolution</span>
                <textarea className="input input--area" rows={3} maxLength={2000} value={form.resolution} onChange={update('resolution')} placeholder="How the issue was resolved." />
              </label>

              <label className="field">
                <span className="field__label">Internal update</span>
                <textarea className="input input--area" rows={2} maxLength={1000} value={form.note} onChange={update('note')} placeholder="Added to the ticket history. The customer does not see internal notes." />
              </label>
            </>
          ) : null}

          {complaint.history?.length ? (
            <div className="ops-timeline">
              <p className="drawer__section-label">History</p>
              <ul>
                {[...complaint.history].reverse().map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span className="ops-timeline__mark" aria-hidden="true" />
                    <div>
                      <strong>{entry.statusLabel || entry.status}</strong>
                      {entry.note ? <p>{entry.note}</p> : null}
                    </div>
                    <time>{formatDayTime(entry.at)}</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>{canManage ? 'Cancel' : 'Close'}</button>
            {canManage ? <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save ticket'}</button> : null}
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function ComplaintsPanel({ heading = 'Complaint queue' }) {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'operations';
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const complaints = useComplaints({ status: filters.status, search: filters.search, page, limit: 25 });

  const updateFilter = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const hasFilters = filters.status || filters.search;
  const total = complaints.meta?.total ?? complaints.rows.length;

  return (
    <div className="panel ops-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">{heading}</h2>
          <p className="panel__meta">{total} {total === 1 ? 'ticket' : 'tickets'} recorded</p>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={() => setCreateOpen(true)}>Log complaint <span aria-hidden="true">+</span></button>
          <button type="button" className="btn btn--outline btn--small" onClick={complaints.refresh}>Refresh</button>
        </div>
      </div>

      <div className="ops-toolbar">
        <input aria-label="Search complaints" placeholder="Search ticket, customer or issue…" value={filters.search} onChange={updateFilter('search')} />
        <label><span>Status</span>
          <select aria-label="Filter complaints by status" value={filters.status} onChange={updateFilter('status')}>
            <option value="">All statuses</option>
            {COMPLAINT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {complaints.error ? <p className="app-notice app-notice--error" role="alert">Tickets could not be loaded: {complaints.error}</p> : null}
      {complaints.status === 'loading' ? <p className="data-state" role="status">Loading tickets…</p> : null}

      {complaints.status !== 'loading' && !complaints.error && complaints.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{hasFilters ? 'No tickets match these filters' : 'No complaints recorded'}</h2>
          <p>{hasFilters ? 'Clear the filters to see the rest of the queue.' : 'Tickets logged by the sales team will appear here. No sample tickets are shown.'}</p>
        </div>
      ) : null}

      {complaints.rows.length > 0 ? (
        <div className="ops-table__scroll">
          <div className="ops-table ops-table--complaints">
            <div className="ops-table__head">
              <span>Ticket</span><span>Customer</span><span>Issue</span><span>Priority</span><span>Owner</span><span>Status</span><span>Logged</span>
            </div>
            {complaints.rows.map((complaint) => (
              <button type="button" className="ops-table__row" key={complaint.id} onClick={() => setSelected(complaint)}>
                <span className="ops-mono">{complaint.reference}</span>
                <span><strong>{complaint.customerName || '—'}</strong><small>{complaint.phone || '—'}</small></span>
                <span><strong>{complaint.title}</strong><small>{complaint.category}</small></span>
                <span><PriorityTag priority={complaint.priority} /></span>
                <span className="ops-cell-muted">{complaint.assignedTo?.name || 'Unassigned'}</span>
                <span><StatusPill status={complaint.status} label={complaint.statusLabel} /></span>
                <span className="ops-cell-muted">{formatDayTime(complaint.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {complaints.meta && complaints.meta.pages > 1 ? (
        <div className="ops-pager">
          <span>Page {complaints.meta.page} of {complaints.meta.pages} · {complaints.meta.total} tickets</span>
          <div className="ops-pager__buttons">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={complaints.meta.page <= 1}>Previous</button>
            <button type="button" onClick={() => setPage((value) => Math.min(complaints.meta.pages, value + 1))} disabled={complaints.meta.page >= complaints.meta.pages}>Next</button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <ComplaintDrawer key={selected.id} complaint={selected} canManage={canManage} onClose={() => setSelected(null)} onSaved={complaints.refresh} />
      ) : null}

      {createOpen ? <CreateComplaintDrawer onClose={() => setCreateOpen(false)} onCreated={complaints.refresh} /> : null}
    </div>
  );
}
