import { useState } from 'react';

import { formatDay } from '../../app/operations.js';
import { useKnownStations, useTechnicianStock, useTechnicians } from '../../hooks/useOperations.js';
import { createTechnicianRecord, updateTechnicianRecord } from '../../lib/api.js';
import StationField from './StationField.jsx';

function AddTechnicianDrawer({ stations, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', station: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTechnicianRecord(form);
      onCreated();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The technician could not be added.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close technician form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-technician-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Field team</p>
            <h2 className="drawer__title" id="add-technician-title">Add a technician</h2>
            <p className="drawer__subtitle">Technicians can be assigned station-wise once they are on the register.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="drawer__section-label">Details</div>
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">Full name <i>Required</i></span>
              <input className="input" value={form.name} onChange={update('name')} minLength={2} maxLength={120} required autoComplete="name" />
            </label>
            <label className="field">
              <span className="field__label">Phone</span>
              <input className="input" value={form.phone} onChange={update('phone')} maxLength={40} autoComplete="tel" placeholder="Contact number" />
            </label>
            <StationField label="Home station" value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} stations={stations} required />
            <label className="field field--full">
              <span className="field__label">Notes</span>
              <textarea className="input input--area" rows={2} maxLength={1000} value={form.notes} onChange={update('notes')} placeholder="Skills, shift, vehicle or anything the desk should know." />
            </label>
          </div>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Adding…' : 'Add technician'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function TechniciansPanel() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const technicians = useTechnicians({ search });
  const stock = useTechnicianStock();
  const stations = useKnownStations([technicians.rows]);
  const counts = new Map(stock.rows.map((row) => [row.technicianId, row]));

  async function toggle(technician) {
    await updateTechnicianRecord(technician.id, { active: !technician.active });
    technicians.refresh();
  }

  return (
    <div className="panel ops-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Field technicians</h2>
          <p className="panel__meta">{technicians.rows.length} registered</p>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={() => setAddOpen(true)}>Add technician <span aria-hidden="true">+</span></button>
          <button type="button" className="btn btn--outline btn--small" onClick={technicians.refresh}>Refresh</button>
        </div>
      </div>

      <div className="ops-toolbar">
        <input aria-label="Search technicians" placeholder="Search name, phone or station…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {technicians.error ? <p className="app-notice app-notice--error" role="alert">Technicians could not be loaded: {technicians.error}</p> : null}
      {technicians.status === 'loading' ? <p className="data-state" role="status">Loading technicians…</p> : null}

      {technicians.status !== 'loading' && !technicians.error && technicians.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>No technicians registered</h2>
          <p>Add the field team here, then assign jobs and stock station-wise from the work queue.</p>
        </div>
      ) : null}

      {technicians.rows.length > 0 ? (
        <div className="ops-table__scroll">
          <div className="ops-table ops-table--technicians">
            <div className="ops-table__head"><span>Name</span><span>Phone</span><span>Station</span><span>Devices held</span><span>SIMs held</span><span>Status</span><span>Added</span><span aria-hidden="true" /></div>
            {technicians.rows.map((technician) => (
              <div className="ops-table__row" key={technician.id}>
                <span><strong>{technician.name}</strong>{technician.notes ? <small>{technician.notes}</small> : null}</span>
                <span className="ops-cell-muted">{technician.phone || '—'}</span>
                <span>{technician.station || '—'}</span>
                <span className="ops-cell-stack">
                  <span className="ops-number">{counts.get(technician.id)?.devices.held ?? 0}</span>
                  {counts.get(technician.id)?.low ? <span className="ops-low">Low</span> : null}
                </span>
                <span className="ops-number">{counts.get(technician.id)?.sims.held ?? 0}</span>
                <span className="ops-status" data-tone={technician.active ? 'done' : 'muted'}>{technician.active ? 'Active' : 'Inactive'}</span>
                <span className="ops-cell-muted">{formatDay(technician.createdAt)}</span>
                <span className="ops-row-action">
                  <button type="button" className="ops-link" onClick={() => toggle(technician)}>{technician.active ? 'Deactivate' : 'Activate'}</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {addOpen ? <AddTechnicianDrawer stations={stations} onClose={() => setAddOpen(false)} onCreated={technicians.refresh} /> : null}
    </div>
  );
}
