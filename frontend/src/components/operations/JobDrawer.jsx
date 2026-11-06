import { useMemo, useState } from 'react';

import { CHECKLIST_ITEMS, ENGINE_KILL_OPTIONS, PLACEMENT_SUGGESTIONS, completionMissing } from '../../app/installation.js';
import { JOB_STATUS_OPTIONS, formatDayTime, requestTypeLabel } from '../../app/operations.js';
import { useDevices, useKnownStations, useSims, useTechnicians } from '../../hooks/useOperations.js';
import { updateJobRecord } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import InstallationHistory from './InstallationHistory.jsx';
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

function Section({ step, title, hint, children }) {
  return (
    <section className="inst-section">
      <header className="inst-section__head">
        {step ? <span className="inst-section__step" aria-hidden="true">{step}</span> : null}
        <div>
          <h3>{title}</h3>
          {hint ? <p>{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * The installation record. Operations enters what the technician reports; the
 * technician has no login. Completion is only offered once the essentials, the
 * tests and an engine-kill decision are on record.
 */
export default function JobDrawer({ job, onClose, onSaved }) {
  const technicians = useTechnicians({ activeOnly: true });
  // Station stock and stock already handed to a technician can both be fitted.
  const devices = useDevices({ limit: 100 });
  const sims = useSims({ limit: 100 });
  const stations = useKnownStations([technicians.rows, devices.rows, sims.rows]);

  const isInstall = job.requestType === 'new_installation';
  const wasCompleted = job.status === 'completed';
  const inst = job.installation ?? {};

  const [form, setForm] = useState({
    status: job.status,
    technicianId: job.technician?.id ?? '',
    deviceImei: job.deviceImei ?? '',
    simNumber: job.simNumber ?? '',
    station: job.vehicle?.station ?? '',
    scheduledAt: toLocalInput(job.scheduledAt),
    note: '',
    deviceModel: inst.deviceModel ?? '',
    placement: inst.placement ?? '',
    address: inst.address ?? '',
    engineNo: job.vehicle?.engineNo ?? '',
    chassisNo: job.vehicle?.chassisNo ?? '',
    batteryTemperatureC: inst.batteryTemperatureC ?? '',
    testResult: inst.testResult ?? '',
    technicianRemarks: inst.technicianRemarks ?? '',
    operationsRemarks: inst.operationsRemarks ?? '',
    checklist: { ...(inst.checklist ?? {}) },
    engineKillStatus: job.engineKill?.status ?? 'not_set',
    engineKillReason: job.engineKill?.reason ?? '',
    completedAt: toLocalInput(job.completedAt) || toLocalInput(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggle = (key) => (event) => setForm((current) => ({ ...current, checklist: { ...current.checklist, [key]: event.target.checked } }));

  const deviceOptions = devices.rows.filter((device) => !device.job || device.job === job.id);
  const simOptions = sims.rows.filter((sim) => !sim.job || sim.job === job.id);
  if (job.deviceImei && !deviceOptions.some((device) => device.imei === job.deviceImei)) {
    deviceOptions.unshift({ imei: job.deviceImei, technician: null });
  }
  if (job.simNumber && !simOptions.some((sim) => sim.number === job.simNumber)) {
    simOptions.unshift({ number: job.simNumber, technician: null });
  }

  const completing = isInstall && form.status === 'completed' && !job.legacy?.imported;
  const missing = useMemo(() => (isInstall ? completionMissing(form, job) : []), [form, job, isInstall]);
  const blocked = completing && missing.length > 0;
  const ticked = CHECKLIST_ITEMS.filter((item) => form.checklist[item.key]).length;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      status: form.status,
      technicianId: form.technicianId || null,
      deviceImei: form.deviceImei,
      simNumber: form.simNumber,
      station: form.station,
      scheduledAt: form.scheduledAt || null,
      note: form.note,
    };

    if (isInstall) {
      Object.assign(payload, {
        deviceModel: form.deviceModel,
        placement: form.placement,
        address: form.address,
        engineNo: form.engineNo,
        chassisNo: form.chassisNo,
        batteryTemperatureC: form.batteryTemperatureC === '' ? null : Number(form.batteryTemperatureC),
        testResult: form.testResult,
        technicianRemarks: form.technicianRemarks,
        operationsRemarks: form.operationsRemarks,
        checklist: form.checklist,
      });
      if (form.engineKillStatus !== 'not_set') payload.engineKill = { status: form.engineKillStatus, reason: form.engineKillReason };
      if (form.status === 'completed' && !wasCompleted && form.completedAt) payload.completedAt = new Date(form.completedAt).toISOString();
    }

    try {
      const result = await updateJobRecord(job.id, payload);
      onSaved(result.data.job);
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
      <section className="drawer drawer--wide" role="dialog" aria-modal="true" aria-labelledby="job-drawer-title">
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

          <Section step={isInstall ? '1' : null} title="Assignment" hint="Who goes, from which station, and when.">
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
          </Section>

          <Section step={isInstall ? '2' : null} title={isInstall ? 'Device & SIM' : 'Stock allocation'} hint="Station stock and stock already handed to a technician can be fitted. An item already fitted to another job is rejected.">
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
              {isInstall ? (
                <>
                  <label className="field">
                    <span className="field__label">GPS device model / type</span>
                    <input className="input" maxLength={120} value={form.deviceModel} onChange={update('deviceModel')} placeholder="e.g. FMB920" />
                  </label>
                  <label className="field">
                    <span className="field__label">Device location in vehicle <b className="req">required</b></span>
                    <input className="input" list="placement-suggestions" maxLength={160} value={form.placement} onChange={update('placement')} placeholder="e.g. Under dashboard" />
                    <datalist id="placement-suggestions">{PLACEMENT_SUGGESTIONS.map((p) => <option key={p} value={p} />)}</datalist>
                  </label>
                </>
              ) : null}
            </div>
          </Section>

          {isInstall ? (
            <>
              <Section step="3" title="Vehicle & site" hint="As confirmed by the technician on site.">
                <div className="field-grid">
                  <label className="field field--full">
                    <span className="field__label">Installation address / location <b className="req">required</b></span>
                    <input className="input" maxLength={400} value={form.address} onChange={update('address')} placeholder="Where the vehicle was when the device was fitted" />
                  </label>
                  <label className="field">
                    <span className="field__label">Engine number</span>
                    <input className="input" maxLength={60} value={form.engineNo} onChange={update('engineNo')} />
                  </label>
                  <label className="field">
                    <span className="field__label">Chassis number</span>
                    <input className="input" maxLength={60} value={form.chassisNo} onChange={update('chassisNo')} />
                  </label>
                  <label className="field">
                    <span className="field__label">Vehicle battery temperature (°C)</span>
                    <input className="input" type="number" step="0.1" min="-50" max="150" value={form.batteryTemperatureC} onChange={update('batteryTemperatureC')} placeholder="Where available" />
                  </label>
                </div>
              </Section>

              <Section step="4" title="Testing & checklist" hint={`${ticked} of ${CHECKLIST_ITEMS.length} ticked. Tick only what the technician confirmed.`}>
                <ul className="inst-checklist">
                  {CHECKLIST_ITEMS.map((item) => (
                    <li key={item.key}>
                      <label className={form.checklist[item.key] ? 'is-on' : ''}>
                        <input type="checkbox" checked={Boolean(form.checklist[item.key])} onChange={toggle(item.key)} />
                        <span>
                          {item.label}
                          {!item.core ? <small>{item.hint}</small> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="field-grid">
                  <label className="field field--full">
                    <span className="field__label">Testing results</span>
                    <textarea className="input input--area" rows={2} maxLength={1000} value={form.testResult} onChange={update('testResult')} placeholder="What the tests showed" />
                  </label>
                  <label className="field">
                    <span className="field__label">Technician remarks</span>
                    <textarea className="input input--area" rows={2} maxLength={1000} value={form.technicianRemarks} onChange={update('technicianRemarks')} />
                  </label>
                  <label className="field">
                    <span className="field__label">Operations remarks</span>
                    <textarea className="input input--area" rows={2} maxLength={1000} value={form.operationsRemarks} onChange={update('operationsRemarks')} />
                  </label>
                </div>
              </Section>

              <Section step="5" title="Engine kill" hint="Recorded separately. Not implemented does not stop the GPS installation from being completed.">
                <div className="field-grid">
                  <label className="field">
                    <span className="field__label">Engine kill status</span>
                    <select className="input" value={form.engineKillStatus} onChange={update('engineKillStatus')}>
                      {ENGINE_KILL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{form.engineKillStatus === 'not_implemented' ? <>Reason <b className="req">required</b></> : 'Note'}</span>
                    <input className="input" maxLength={400} value={form.engineKillReason} onChange={update('engineKillReason')} placeholder={form.engineKillStatus === 'not_implemented' ? 'Why it could not be done' : 'Optional'} disabled={form.engineKillStatus === 'not_set'} />
                  </label>
                </div>
              </Section>
            </>
          ) : null}

          <Section step={isInstall ? '6' : null} title="Progress">
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
              <label className="field">
                <span className="field__label">Job status</span>
                <select className="input" value={form.status} onChange={update('status')}>
                  {JOB_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {completing && !wasCompleted ? (
                <label className="field">
                  <span className="field__label">Completed on</span>
                  <input className="input" type="datetime-local" max={toLocalInput(new Date())} value={form.completedAt} onChange={update('completedAt')} />
                </label>
              ) : <span />}
              <label className="field field--full">
                <span className="field__label">Visit note</span>
                <textarea className="input input--area" rows={2} maxLength={1000} value={form.note} onChange={update('note')} placeholder="What happened on site?" />
              </label>
            </div>

            {completing && !wasCompleted ? (
              <div className={`inst-ready${missing.length ? '' : ' is-ready'}`} role="status">
                {missing.length ? (
                  <>
                    <strong>Not ready to complete — {missing.length} thing{missing.length === 1 ? '' : 's'} still needed</strong>
                    <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul>
                  </>
                ) : (
                  <strong>Everything required is recorded. This installation can be completed.</strong>
                )}
              </div>
            ) : null}
          </Section>

          {job.history?.length ? (
            <Section title="Installation history" hint="Status changes, checklist saves and engine kill changes, newest first.">
              <InstallationHistory history={job.history} />
            </Section>
          ) : null}

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving || blocked} title={blocked ? 'Finish the items listed above first' : undefined}>
              {saving ? 'Saving…' : completing && !wasCompleted ? 'Complete installation' : 'Save job'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
