import { useState } from 'react';

import { updateJobRecord } from '../../lib/api.js';

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export default function VehicleEditDrawer({ job, onClose, onSaved }) {
  const [form, setForm] = useState({
    vehicleLabel: job.vehicle?.label ?? '',
    vehicleRegistration: job.vehicle?.registration ?? '',
    station: job.vehicle?.station ?? '',
    engineNo: job.vehicle?.engineNo ?? '',
    chassisNo: job.vehicle?.chassisNo ?? '',
    colour: job.vehicle?.colour ?? '',
    deviceImei: job.deviceImei ?? '',
    simNumber: job.simNumber ?? '',
    simMode: job.simMode ?? '',
    loginId: job.loginId ?? '',
    oldVrn: job.oldVrn ?? '',
    installationDate: toDateInput(job.installationDate),
    installationMonth: job.installationMonth ?? '',
    recordYear: job.recordYear ?? '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = await updateJobRecord(job.id, form);
      onSaved(payload.data.job);
      onClose();
    } catch (error_) {
      setError(error_.message || 'Vehicle details could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close vehicle editor" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="vehicle-edit-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Vehicle record</p>
            <h2 className="drawer__title" id="vehicle-edit-title">Edit vehicle details</h2>
            <p className="drawer__subtitle">{job.reference} · changes are saved to this installation record.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="drawer__form" onSubmit={submit}>
          <div className="field-grid">
            <label className="field field--full"><span className="field__label">Vehicle make / model</span><input className="input" maxLength={120} value={form.vehicleLabel} onChange={update('vehicleLabel')} placeholder="e.g. Toyota Corolla" /></label>
            <label className="field field--full"><span className="field__label">Registration number</span><input className="input" maxLength={60} value={form.vehicleRegistration} onChange={update('vehicleRegistration')} placeholder="e.g. ABC-123" /></label>
            <label className="field field--full"><span className="field__label">Installation station / location</span><input className="input" maxLength={120} value={form.station} onChange={update('station')} placeholder="Installation location" /></label>
            <label className="field"><span className="field__label">Engine number</span><input className="input" maxLength={60} value={form.engineNo} onChange={update('engineNo')} placeholder="Engine number" /></label>
            <label className="field"><span className="field__label">Chassis number</span><input className="input" maxLength={60} value={form.chassisNo} onChange={update('chassisNo')} placeholder="Chassis number" /></label>
            <label className="field"><span className="field__label">Colour</span><input className="input" maxLength={40} value={form.colour} onChange={update('colour')} placeholder="Vehicle colour" /></label>
            <label className="field"><span className="field__label">Device IMEI</span><input className="input" maxLength={20} value={form.deviceImei} onChange={update('deviceImei')} placeholder="IMEI" /></label>
            <label className="field"><span className="field__label">SIM number</span><input className="input" maxLength={40} value={form.simNumber} onChange={update('simNumber')} placeholder="SIM number" /></label>
            <label className="field"><span className="field__label">SIM mode</span><input className="input" maxLength={40} value={form.simMode} onChange={update('simMode')} placeholder="e.g. prepaid" /></label>
            <label className="field"><span className="field__label">Login ID</span><input className="input" maxLength={120} value={form.loginId} onChange={update('loginId')} /></label>
            <label className="field"><span className="field__label">Old VRN</span><input className="input" maxLength={60} value={form.oldVrn} onChange={update('oldVrn')} /></label>
            <label className="field"><span className="field__label">Installation date</span><input className="input" type="date" value={form.installationDate} onChange={update('installationDate')} /></label>
            <label className="field"><span className="field__label">Installation month</span><input className="input" type="number" min="1" max="12" value={form.installationMonth} onChange={update('installationMonth')} placeholder="1–12" /></label>
            <label className="field"><span className="field__label">Record year</span><input className="input" type="number" min="1900" max="2200" value={form.recordYear} onChange={update('recordYear')} /></label>
            <label className="field field--full"><span className="field__label">Correction note</span><textarea className="input input--area" rows={3} maxLength={1000} value={form.note} onChange={update('note')} placeholder="What was corrected?" /></label>
          </div>
          <p className="field__hint">Legacy IMEI and SIM values can be entered here even when they were never added to stock.</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save vehicle'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
