import { useEffect, useState } from 'react';

import { PRIORITY_OPTIONS } from '../../app/operations.js';
import { createJobRecord } from '../../lib/api.js';

/** Push a vehicle installation request for a customer already in the portfolio. */
export default function RequestDrawer({ open, customer, onClose, onSaved }) {
  const emptyForm = { vehicleLabel: '', vehicleRegistration: '', station: '', installDate: '', installTime: '', priority: 'normal', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setForm(emptyForm);
    setError(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, saving, onClose]);

  if (!open || !customer) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError(null);

    if (Boolean(form.installDate) !== Boolean(form.installTime)) {
      setError('Add both the installation date and the installation time, or leave both empty.');
      return;
    }

    setSaving(true);
    try {
      await createJobRecord({
        customerId: customer.id,
        requestType: 'new_installation',
        vehicleLabel: form.vehicleLabel,
        vehicleRegistration: form.vehicleRegistration,
        station: form.station,
        scheduledAt: form.installDate && form.installTime
          ? new Date(`${form.installDate}T${form.installTime}`).toISOString()
          : undefined,
        priority: form.priority,
        notes: form.notes,
      });
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'The request could not be created.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close request form" />
      <section className="drawer drawer--compact" role="dialog" aria-modal="true" aria-labelledby="request-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Operations request</p>
            <h2 className="drawer__title" id="request-title">New installation</h2>
            <p className="drawer__subtitle">{customer.name} · the desk assigns the technician, device and SIM.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Car name / label <i>Required</i></span>
              <input className="input" required maxLength={120} placeholder="e.g. Civic Oriel" value={form.vehicleLabel} onChange={update('vehicleLabel')} autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Registration <i>Required</i></span>
              <input className="input" required maxLength={60} placeholder="e.g. XYZ-9876" value={form.vehicleRegistration} onChange={update('vehicleRegistration')} />
            </label>
            <label className="field field--full">
              <span className="field__label">Installation station / location <i>Required</i></span>
              <input className="input" required maxLength={120} placeholder="City or office where the fitting happens" value={form.station} onChange={update('station')} />
            </label>
            <label className="field">
              <span className="field__label">Installation date</span>
              <input className="input" type="date" value={form.installDate} onChange={update('installDate')} />
            </label>
            <label className="field">
              <span className="field__label">Installation time</span>
              <input className="input" type="time" value={form.installTime} onChange={update('installTime')} />
            </label>
            <label className="field">
              <span className="field__label">Priority</span>
              <select className="input" value={form.priority} onChange={update('priority')}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field field--full">
              <span className="field__label">Notes for the desk</span>
              <textarea className="input input--area" rows={3} maxLength={2000} placeholder="Access details, preferred time, anything the technician should know" value={form.notes} onChange={update('notes')} />
            </label>
          </div>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Sending…' : 'Send to operations'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
