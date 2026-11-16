import { useState } from 'react';

import { updateVehicleInspection } from '../../lib/api.js';

const PHYSICAL_STATUSES = [
  'Verified Active',
  'Pending Inspection',
  'Removed',
  'Needs Redo',
  'Uninstalled',
];

export default function VehicleInspectionModal({ vehicle, onClose, onSaved }) {
  const [physicalStatus, setPhysicalStatus] = useState(vehicle.physicalStatus ?? 'Pending Inspection');
  const [inspectionNotes, setInspectionNotes] = useState(vehicle.inspectionNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateVehicleInspection(vehicle.id, { physicalStatus, inspectionNotes });
      onSaved();
    } catch (saveError) {
      setError(saveError.message || 'The inspection could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close inspection form" />
      <section className="drawer drawer--compact" role="dialog" aria-modal="true" aria-labelledby="inspection-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Field inspection</p>
            <h2 className="drawer__title" id="inspection-title">Log inspection</h2>
            <p className="drawer__subtitle">
              {vehicle.vehicle.registration || 'Vehicle'} · {vehicle.customer.name || 'Customer'}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Physical status <i>Required</i></span>
            <select className="input" value={physicalStatus} onChange={(event) => setPhysicalStatus(event.target.value)} required>
              {PHYSICAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Inspection notes</span>
            <textarea
              className="input input--area"
              rows={5}
              maxLength={2000}
              value={inspectionNotes}
              onChange={(event) => setInspectionNotes(event.target.value)}
              placeholder="For example: Tracker unplugged, customer wants redo."
            />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save inspection'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
