import { useState } from 'react';

import { JOB_STATUS_OPTIONS, PRIORITY_OPTIONS, formatDayTime, requestTypeLabel } from '../../app/operations.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useJobs, useKnownStations, useTechnicians } from '../../hooks/useOperations.js';
import { createJobRecord } from '../../lib/api.js';
import { StatusPill, PriorityTag } from './OpsStatus.jsx';
import JobDrawer from './JobDrawer.jsx';
import StationField from './StationField.jsx';

function CreateJobDrawer({ onClose, onCreated }) {
  const customers = useCustomers({ limit: 100 });
  const technicians = useTechnicians({ activeOnly: true });
  const stations = useKnownStations([technicians.rows]);
  const [form, setForm] = useState({
    customerId: '',
    requestType: 'new_installation',
    vehicleLabel: '',
    vehicleRegistration: '',
    station: '',
    priority: 'normal',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const isInstallation = form.requestType === 'new_installation';

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createJobRecord(form);
      onCreated();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The job could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close new job form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-job-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Operations queue</p>
            <h2 className="drawer__title" id="create-job-title">Add work item</h2>
            <p className="drawer__subtitle">Push a customer request into the field queue.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="drawer__section-label">Customer</div>
          <label className="field">
            <span className="field__label">Customer record <i>Required</i></span>
            <select className="input" value={form.customerId} onChange={update('customerId')} required>
              <option value="">{customers.status === 'loading' ? 'Loading customers…' : 'Select a customer'}</option>
              {customers.rows.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
            </select>
            {customers.status === 'ready' && customers.rows.length === 0 ? <span className="field__hint">No customer records exist yet. Add the customer in the register first.</span> : null}
          </label>

          <div className="drawer__section-label">Request</div>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Request type</span>
              <select className="input" value={form.requestType} onChange={update('requestType')}>
                <option value="new_installation">New installation</option>
                <option value="follow_up">Follow-up</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Priority</span>
              <select className="input" value={form.priority} onChange={update('priority')}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {isInstallation ? (
            <>
              <div className="drawer__section-label">Vehicle & station</div>
              <div className="field-grid">
                <label className="field">
                  <span className="field__label">Vehicle label <i>Required</i></span>
                  <input className="input" value={form.vehicleLabel} onChange={update('vehicleLabel')} placeholder="e.g. Corolla" required />
                </label>
                <label className="field">
                  <span className="field__label">Registration <i>Required</i></span>
                  <input className="input" value={form.vehicleRegistration} onChange={update('vehicleRegistration')} placeholder="e.g. LEB-1234" required />
                </label>
                <div className="field--full">
                  <StationField value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} stations={stations} required />
                </div>
              </div>
            </>
          ) : (
            <StationField value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} stations={stations} label="Follow-up station (optional)" />
          )}

          <label className="field">
            <span className="field__label">Notes for the field team</span>
            <textarea className="input input--area" rows={3} maxLength={2000} value={form.notes} onChange={update('notes')} placeholder="Access details, contact preference, anything the technician needs." />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Adding…' : 'Add to queue'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function JobsPanel({ heading = 'Work queue' }) {
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const jobs = useJobs({ status: filters.status, priority: filters.priority, search: filters.search, page, limit: 25 });

  const updateFilter = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const hasFilters = filters.status || filters.priority || filters.search;
  const total = jobs.meta?.total ?? jobs.rows.length;

  return (
    <div className="panel ops-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">{heading}</h2>
          <p className="panel__meta">{total} {total === 1 ? 'job' : 'jobs'} recorded</p>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={() => setCreateOpen(true)}>Add job <span aria-hidden="true">+</span></button>
          <button type="button" className="btn btn--outline btn--small" onClick={jobs.refresh}>Refresh</button>
        </div>
      </div>

      <div className="ops-toolbar">
        <input aria-label="Search jobs" placeholder="Search reference, customer, registration or IMEI…" value={filters.search} onChange={updateFilter('search')} />
        <label><span>Status</span>
          <select aria-label="Filter by status" value={filters.status} onChange={updateFilter('status')}>
            <option value="">All statuses</option>
            {JOB_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label><span>Priority</span>
          <select aria-label="Filter by priority" value={filters.priority} onChange={updateFilter('priority')}>
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {jobs.error ? <p className="app-notice app-notice--error" role="alert">The work queue could not be loaded: {jobs.error}</p> : null}
      {jobs.status === 'loading' ? <p className="data-state" role="status">Loading the work queue…</p> : null}

      {jobs.status !== 'loading' && !jobs.error && jobs.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{hasFilters ? 'No jobs match these filters' : 'No work in the queue yet'}</h2>
          <p>{hasFilters ? 'Clear the filters to see the rest of the queue.' : 'Installation and follow-up work pushed by the sales team will appear here. Nothing is generated for display.'}</p>
        </div>
      ) : null}

      {jobs.rows.length > 0 ? (
        <div className="ops-table__scroll">
          <div className="ops-table ops-table--jobs">
            <div className="ops-table__head">
              <span>Job</span><span>Customer / vehicle</span><span>Station</span><span>Technician</span><span>Status</span><span>Schedule</span>
            </div>
            {jobs.rows.map((job) => (
              <button type="button" className="ops-table__row" key={job.id} onClick={() => setSelected(job)}>
                <span>
                  <strong className="ops-mono">{job.reference}</strong>
                  <small>{requestTypeLabel(job.requestType)}</small>
                </span>
                <span>
                  <strong>{job.customerName || 'Customer'}</strong>
                  <small>{[job.vehicle.label, job.vehicle.registration].filter(Boolean).join(' · ') || job.phone || '—'}</small>
                </span>
                <span className="ops-cell-muted">{job.vehicle.station || '—'}</span>
                <span>{job.technician?.name || <span className="ops-cell-muted">Unassigned</span>}</span>
                <span className="ops-cell-stack"><StatusPill status={job.status} label={job.statusLabel} />{job.priority === 'high' || job.priority === 'urgent' ? <PriorityTag priority={job.priority} /> : null}</span>
                <span className="ops-cell-muted">{job.scheduledAt ? formatDayTime(job.scheduledAt) : 'Not scheduled'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {jobs.meta && jobs.meta.pages > 1 ? (
        <div className="ops-pager">
          <span>Page {jobs.meta.page} of {jobs.meta.pages} · {jobs.meta.total} jobs</span>
          <div className="ops-pager__buttons">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={jobs.meta.page <= 1}>Previous</button>
            <button type="button" onClick={() => setPage((value) => Math.min(jobs.meta.pages, value + 1))} disabled={jobs.meta.page >= jobs.meta.pages}>Next</button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <JobDrawer key={selected.id} job={selected} onClose={() => setSelected(null)} onSaved={() => jobs.refresh()} />
      ) : null}

      {createOpen ? <CreateJobDrawer onClose={() => setCreateOpen(false)} onCreated={jobs.refresh} /> : null}
    </div>
  );
}
