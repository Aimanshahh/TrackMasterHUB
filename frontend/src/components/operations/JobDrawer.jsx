import { useState } from 'react';

import { JOB_STATUS_OPTIONS, formatDayTime, requestTypeLabel } from '../../app/operations.js';
import { useDevices, useKnownStations, useSims, useTechnicians } from '../../hooks/useOperations.js';
import { updateJobRecord } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import { StatusPill } from './OpsStatus.jsx';
import StationField from './StationField.jsx';

const APPROVAL_LABELS = {
  not_required: 'Not required',
  pending: 'Waiting for admin',
  approved: 'Approved',
  rejected: 'Rejected',
};

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function JobDrawer({ job, onClose, onSaved }) {
  const technicians = useTechnicians({ activeOnly: true });
  // Station stock and stock already handed to a technician can both be fitted.
  const devices = useDevices({ limit: 100 });
  const sims = useSims({ limit: 100 });
  const stations = useKnownStations([technicians.rows, devices.rows, sims.rows]);

  const [form, setForm] = useState({
    status: job.status,
    technicianId: job.technician?.id ?? '',
    deviceImei: job.deviceImei ?? '',
    simNumber: job.simNumber ?? '',
    station: job.vehicle?.station ?? '',
    scheduledAt: toLocalInput(job.scheduledAt),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const deviceOptions = devices.rows.filter((device) => !device.job || device.job === job.id);
  const simOptions = sims.rows.filter((sim) => !sim.job || sim.job === job.id);
  if (job.deviceImei && !deviceOptions.some((device) => device.imei === job.deviceImei)) {
    deviceOptions.unshift({ imei: job.deviceImei, technician: null });
  }
  if (job.simNumber && !simOptions.some((sim) => sim.number === job.simNumber)) {
    simOptions.unshift({ number: job.simNumber, technician: null });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = await updateJobRecord(job.id, {
        status: form.status,
        technicianId: form.technicianId || null,
        deviceImei: form.deviceImei,
        simNumber: form.simNumber,
        station: form.station,
        scheduledAt: form.scheduledAt || null,
        note: form.note,
      });

      onSaved(payload.data.job);
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The job could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close job" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="job-drawer-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{job.reference} · {requestTypeLabel(job.requestType)}</p>
            <h2 className="drawer__title" id="job-drawer-title">{job.customerName || 'Customer job'}</h2>
            <p className="drawer__subtitle">{job.phone || 'No phone recorded'}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={handleSubmit}>
          <div className="ops-summary">
            <div><span>Current status</span><StatusPill status={job.status} label={job.statusLabel} /></div>
            <div><span>Vehicle</span><strong>{job.vehicle?.label || '—'}</strong></div>
            <div><span>Registration</span><strong>{job.vehicle?.registration || '—'}</strong></div>
            <div><span>Package</span><strong>{job.packageName || '—'}</strong></div>
            <div><span>Quoted</span><strong>{job.quotedPrice === null || job.quotedPrice === undefined ? '—' : formatMoney(job.quotedPrice)}</strong></div>
            <div><span>Price approval</span><strong>{APPROVAL_LABELS[job.approvalStatus] ?? 'Not required'}</strong></div>
            <div><span>Pushed</span><strong>{formatDayTime(job.createdAt)}</strong></div>
          </div>

          <div className="drawer__section-label">Assignment</div>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Technician</span>
              <select className="input" value={form.technicianId} onChange={update('technicianId')}>
                <option value="">Unassigned</option>
                {technicians.rows.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name}{technician.station ? ` · ${technician.station}` : ''}</option>
                ))}
              </select>
              {technicians.status === 'error' ? <span className="field__hint">Technician list unavailable.</span> : null}
            </label>
            <StationField value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} stations={stations} required />
            <label className="field field--full">
              <span className="field__label">Scheduled visit</span>
              <input className="input" type="datetime-local" value={form.scheduledAt} onChange={update('scheduledAt')} />
            </label>
          </div>

          <div className="drawer__section-label">Stock allocation</div>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Device IMEI</span>
              <select className="input" value={form.deviceImei} onChange={update('deviceImei')}>
                <option value="">No device allocated</option>
                {deviceOptions.map((device) => (
                  <option key={device.imei} value={device.imei}>
                    {device.imei}{device.technician?.name ? ` · with ${device.technician.name}` : ' · station stock'}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">SIM number</span>
              <select className="input" value={form.simNumber} onChange={update('simNumber')}>
                <option value="">No SIM allocated</option>
                {simOptions.map((sim) => (
                  <option key={sim.number} value={sim.number}>
                    {sim.number}{sim.technician?.name ? ` · with ${sim.technician.name}` : ' · station stock'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field__hint">Station stock and stock already handed to a technician can be fitted. An item already fitted to another job is rejected by the server.</p>

          <div className="drawer__section-label">Progress</div>
          {job.approvalStatus === 'pending' ? (
            <p className="quote-note" data-state="below">
              The admin has not approved the discounted price yet. The job can be assigned and scheduled, but it cannot be completed until the price is approved.
            </p>
          ) : null}
          {job.approvalStatus === 'rejected' ? (
            <p className="quote-note" data-state="over">
              The quoted price was rejected. The salesperson has to requote before this installation can be completed.
            </p>
          ) : null}
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">Job status</span>
              <select className="input" value={form.status} onChange={update('status')}>
                {JOB_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field field--full">
              <span className="field__label">Visit note</span>
              <textarea className="input input--area" rows={3} maxLength={1000} value={form.note} onChange={update('note')} placeholder="What happened on site?" />
            </label>
          </div>

          {job.history?.length ? (
            <div className="ops-timeline">
              <p className="drawer__section-label">History</p>
              <ul>
                {[...job.history].reverse().map((entry, index) => (
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
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save job'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
