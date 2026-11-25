import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianJob } from '../../hooks/useTechnician.js';
import {
  requestEngineKillTest,
  saveTechnicianTest,
  selectTechnicianStock,
  submitInstallationForReview,
} from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const TESTS = [
  {
    key: 'battery',
    title: 'Battery & disconnect',
    lead: 'Confirm the tracker is powered by the vehicle and the battery disconnect is reported.',
  },
  {
    key: 'ignition',
    title: 'Ignition ON / OFF',
    lead: 'Switch the ignition and confirm the change is reported by the device.',
  },
  {
    key: 'location',
    title: 'Installation location',
    lead: 'Record where the device was fitted and confirm the tracker reports a position.',
  },
];

function toneFor(status) {
  if (status === 'verified') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'requested') return 'warn';
  return 'plain';
}

function labelFor(status) {
  if (status === 'verified') return 'Verified';
  if (status === 'failed') return 'Failed';
  if (status === 'requested') return 'Requested';
  return 'Not done';
}

function TelemetryValue({ value, suffix = '' }) {
  if (value === null || value === undefined || value === '') return <span className="tech-telemetry__none">not reported</span>;
  return <span>{String(value)}{suffix}</span>;
}

export default function TechnicianJobPage() {
  const { id } = useParams();
  const { data, status, error, refresh } = useTechnicianJob(id);
  const job = data?.job;
  useDocumentTitle(job ? `${job.reference}` : 'Installation');

  const [imei, setImei] = useState('');
  const [simNumber, setSimNumber] = useState('');
  const [forms, setForms] = useState({});
  const [engineKillNote, setEngineKillNote] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!job) return;
    setImei(job.deviceImei ?? '');
    setSimNumber(job.simNumber ?? '');
  }, [job?.deviceImei, job?.simNumber, job?.id]);

  const closed = job ? ['completed', 'cancelled'].includes(job.status) : false;
  const submitted = Boolean(job?.testing?.submittedAt) && job?.testing?.review?.status === 'pending';

  const missing = useMemo(() => {
    if (!job) return [];
    const list = [];
    if (!job.deviceImei || !job.simNumber) list.push('select your device and SIM');
    if (job.testing?.battery?.status !== 'verified') list.push('battery test');
    if (job.testing?.ignition?.status !== 'verified') list.push('ignition test');
    if (job.testing?.location?.status !== 'verified') list.push('location test');
    if (!['requested', 'verified'].includes(job.testing?.engineKillTest?.status)) list.push('engine kill request');
    return list;
  }, [job]);

  function updateForm(key, patch) {
    setForms((previous) => ({ ...previous, [key]: { ...(previous[key] ?? {}), ...patch } }));
  }

  async function run(action, work) {
    setBusy(action);
    setMessage(null);
    try {
      await work();
      await refresh();
      return true;
    } catch (problem) {
      setMessage({ tone: 'error', text: problem.message });
      return false;
    } finally {
      setBusy('');
    }
  }

  async function saveStock(event) {
    event.preventDefault();
    const ok = await run('stock', () => selectTechnicianStock(id, { imei, simNumber }));
    if (ok) setMessage({ tone: 'ok', text: 'Device and SIM confirmed against your stock.' });
  }

  async function saveTest(key, event) {
    event.preventDefault();
    const form = forms[key] ?? {};
    const payload = { [key]: { ...form, status: form.status ?? 'verified' } };
    const ok = await run(`test-${key}`, () => saveTechnicianTest(id, payload));
    if (ok) setMessage({ tone: 'ok', text: `${TESTS.find((entry) => entry.key === key)?.title ?? 'Test'} recorded.` });
  }

  async function requestKill(event) {
    event.preventDefault();
    const ok = await run('kill', () => requestEngineKillTest(id, { note: engineKillNote }));
    if (ok) {
      setEngineKillNote('');
      setMessage({ tone: 'ok', text: 'Request sent to operations. They will coordinate the kill and restore test.' });
    }
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await run('submit', () => submitInstallationForReview(id));
    if (ok) setMessage({ tone: 'ok', text: 'Submitted to operations for approval.' });
  }

  if (status === 'loading') return <div className="tech-page"><p className="tech-state">Loading the installation…</p></div>;

  if (error) {
    return (
      <div className="tech-page">
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refresh}>Try again</button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const telemetry = data?.telemetry;
  const review = job.testing?.review ?? {};
  const engineKillTest = job.testing?.engineKillTest ?? {};

  return (
    <div className="tech-page tech-page--detail">
      <Link className="tech-back" to="/technician/installations">← All installations</Link>

      {message ? (
        <div className={`tech-message tech-message--${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      ) : null}

      {submitted ? (
        <div className="tech-banner">
          <strong>Waiting on operations</strong>
          <p>Submitted {formatDateTime(job.testing.submittedAt)} by {job.testing.submittedByName || 'you'}. You will be notified when it is approved or needs a retest.</p>
        </div>
      ) : null}

      {review.status === 'rejected' || review.status === 'retest' ? (
        <div className="tech-banner tech-banner--warn">
          <strong>{review.status === 'rejected' ? 'Rejected by operations' : 'Retest requested'}</strong>
          <p>{review.note || 'Operations asked for the installation to be checked again.'}</p>
        </div>
      ) : null}

      <section className="tech-detail-head">
        <p className="tech-detail-head__ref">{job.reference}</p>
        <h1>{job.customerName}</h1>
        <p className="tech-detail-head__meta">
          {job.vehicle?.label || 'Vehicle'} · {job.vehicle?.registration || 'no registration'}
        </p>
        <dl className="tech-facts">
          <div><dt>Schedule</dt><dd>{formatDateTime(job.scheduledAt)}</dd></div>
          <div><dt>Station</dt><dd>{job.vehicle?.station || '—'}</dd></div>
          <div><dt>Package</dt><dd>{job.packageName || '—'}</dd></div>
          <div><dt>Contact</dt><dd>{job.phone || '—'}</dd></div>
          <div><dt>Address</dt><dd>{job.installation?.address || 'Not recorded yet'}</dd></div>
          <div><dt>Status</dt><dd>{job.statusLabel}</dd></div>
        </dl>
        {job.notes ? <p className="tech-ops-note"><strong>Operations note:</strong> {job.notes}</p> : null}
      </section>

      <section className="tech-section">
        <div className="tech-section__head">
          <h2>Device &amp; SIM</h2>
          <span className={`tech-pill tech-pill--${job.deviceImei && job.simNumber ? 'ok' : 'plain'}`}>
            {job.deviceImei && job.simNumber ? 'Selected' : 'Not selected'}
          </span>
        </div>
        <p className="tech-section__lead">
          Type the IMEI and SIM exactly as printed. Both must belong to your own stock — a single wrong digit is rejected.
        </p>

        <form className="tech-form" onSubmit={saveStock}>
          <label className="tech-field">
            <span>Device IMEI</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={imei}
              onChange={(event) => setImei(event.target.value)}
              list="tech-device-options"
              disabled={closed || busy === 'stock'}
              placeholder="e.g. 354735376636604"
            />
            <datalist id="tech-device-options">
              {(data?.stock?.devices ?? []).map((device) => <option key={device.id} value={device.imei} />)}
            </datalist>
          </label>
          <label className="tech-field">
            <span>SIM number</span>
            <input
              type="text"
              autoComplete="off"
              value={simNumber}
              onChange={(event) => setSimNumber(event.target.value)}
              list="tech-sim-options"
              disabled={closed || busy === 'stock'}
              placeholder="SIM fitted with this device"
            />
            <datalist id="tech-sim-options">
              {(data?.stock?.sims ?? []).map((sim) => <option key={sim.id} value={sim.number} />)}
            </datalist>
          </label>
          <button type="submit" className="btn btn--primary btn--small" disabled={closed || busy === 'stock'}>
            {busy === 'stock' ? 'Checking…' : 'Confirm device & SIM'}
          </button>
        </form>

        {(data?.stock?.devices ?? []).length === 0 ? (
          <p className="tech-note">No device is issued to you right now. Ask operations to assign stock before you install.</p>
        ) : null}
      </section>

      {telemetry ? (
        <section className="tech-section">
          <div className="tech-section__head">
            <h2>Tracking portal</h2>
            <span className="tech-section__asof">
              {telemetry.syncedAt ? `read ${formatDateTime(telemetry.syncedAt)}` : 'not read yet'}
            </span>
          </div>
          {telemetry.found ? (
            <dl className="tech-telemetry">
              <div><dt>Connection</dt><dd>{telemetry.gpsState || 'unknown'}</dd></div>
              <div><dt>Last report</dt><dd>{telemetry.lastSeenAt ? formatDateTime(telemetry.lastSeenAt) : 'never'}</dd></div>
              <div><dt>Object status</dt><dd><TelemetryValue value={telemetry.objectStatus} /></dd></div>
              <div><dt>Ignition</dt><dd><TelemetryValue value={telemetry.ignitionOn === null ? null : telemetry.ignitionOn ? 'ON' : 'OFF'} /></dd></div>
              <div><dt>Battery temp</dt><dd><TelemetryValue value={telemetry.batteryTemperatureC} suffix=" °C" /></dd></div>
              <div><dt>Battery power</dt><dd><TelemetryValue value={telemetry.batteryConnected === null ? null : telemetry.batteryConnected ? 'connected' : 'disconnected'} /></dd></div>
              <div><dt>GPS position</dt><dd>{telemetry.latitude !== null && telemetry.longitude !== null ? `${telemetry.latitude}, ${telemetry.longitude}` : <span className="tech-telemetry__none">not reported</span>}</dd></div>
            </dl>
          ) : (
            <p className="tech-note">
              {telemetry.error || 'This device is not listed on the tracking portal yet.'} The portal can lag a few minutes after a device is first powered on — verify manually and record it below.
            </p>
          )}
        </section>
      ) : null}

      <section className="tech-section">
        <div className="tech-section__head"><h2>Installation tests</h2></div>
        <p className="tech-section__lead">
          Record what you actually observed. A manual verification carries your name and the time it was recorded.
        </p>

        <div className="tech-checklist">
          {TESTS.map((test) => {
            const state = job.testing?.[test.key] ?? {};
            const form = forms[test.key] ?? {};
            return (
              <article className={`tech-check tech-check--${toneFor(state.status)}`} key={test.key}>
                <header className="tech-check__head">
                  <div>
                    <h3>{test.title}</h3>
                    <p>{test.lead}</p>
                  </div>
                  <span className={`tech-pill tech-pill--${toneFor(state.status)}`}>{labelFor(state.status)}</span>
                </header>

                {state.verifiedAt ? (
                  <p className="tech-check__stamp">
                    Recorded {formatDateTime(state.verifiedAt)} · {state.source === 'portal' ? 'portal reading' : 'manual verification'}
                    {state.verifiedByName ? ` · ${state.verifiedByName}` : ''}
                    {state.note ? ` · ${state.note}` : ''}
                  </p>
                ) : null}

                {!closed ? (
                  <form className="tech-check__form" onSubmit={(event) => saveTest(test.key, event)}>
                    {test.key === 'battery' ? (
                      <>
                        <label className="tech-field tech-field--inline">
                          <span>Battery connected</span>
                          <select value={form.connected ?? ''} onChange={(event) => updateForm(test.key, { connected: event.target.value === '' ? null : event.target.value === 'yes' })}>
                            <option value="">Not checked</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label className="tech-field tech-field--inline">
                          <span>Disconnect works</span>
                          <select value={form.disconnectWorking ?? ''} onChange={(event) => updateForm(test.key, { disconnectWorking: event.target.value === '' ? null : event.target.value === 'yes' })}>
                            <option value="">Not checked</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label className="tech-field tech-field--inline">
                          <span>Temperature °C</span>
                          <input
                            type="number"
                            step="0.1"
                            value={form.temperatureC ?? ''}
                            onChange={(event) => updateForm(test.key, { temperatureC: event.target.value === '' ? null : event.target.value })}
                            placeholder="optional"
                          />
                        </label>
                      </>
                    ) : null}

                    {test.key === 'ignition' ? (
                      <>
                        <label className="tech-field tech-field--inline">
                          <span>Ignition reported</span>
                          <select value={form.ignitionOn ?? ''} onChange={(event) => updateForm(test.key, { ignitionOn: event.target.value === '' ? null : event.target.value === 'on' })}>
                            <option value="">Not checked</option>
                            <option value="on">ON</option>
                            <option value="off">OFF</option>
                          </select>
                        </label>
                        <label className="tech-field tech-field--inline tech-field--wide">
                          <span>Object status seen</span>
                          <input
                            type="text"
                            value={form.objectStatus ?? ''}
                            onChange={(event) => updateForm(test.key, { objectStatus: event.target.value })}
                            placeholder="e.g. parked, ignition on"
                          />
                        </label>
                      </>
                    ) : null}

                    {test.key === 'location' ? (
                      <>
                        <label className="tech-field tech-field--wide">
                          <span>Where the device was fitted</span>
                          <input
                            type="text"
                            value={form.physicalLocation ?? ''}
                            onChange={(event) => updateForm(test.key, { physicalLocation: event.target.value })}
                            placeholder="Address or landmark"
                          />
                        </label>
                        <label className="tech-field tech-field--inline">
                          <span>Latitude</span>
                          <input type="number" step="0.000001" value={form.latitude ?? ''} onChange={(event) => updateForm(test.key, { latitude: event.target.value === '' ? null : event.target.value })} placeholder="optional" />
                        </label>
                        <label className="tech-field tech-field--inline">
                          <span>Longitude</span>
                          <input type="number" step="0.000001" value={form.longitude ?? ''} onChange={(event) => updateForm(test.key, { longitude: event.target.value === '' ? null : event.target.value })} placeholder="optional" />
                        </label>
                        <label className="tech-field tech-field--inline">
                          <span>Position received</span>
                          <select value={form.gpsReceived ?? ''} onChange={(event) => updateForm(test.key, { gpsReceived: event.target.value === '' ? null : event.target.value === 'yes' })}>
                            <option value="">Not checked</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    <label className="tech-field tech-field--wide">
                      <span>Note</span>
                      <input
                        type="text"
                        value={form.note ?? ''}
                        onChange={(event) => updateForm(test.key, { note: event.target.value })}
                        placeholder="Optional remark"
                      />
                    </label>

                    <div className="tech-check__actions">
                      <select
                        aria-label="Test result"
                        value={form.status ?? 'verified'}
                        onChange={(event) => updateForm(test.key, { status: event.target.value })}
                      >
                        <option value="verified">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <button type="submit" className="btn btn--outline btn--small" disabled={busy === `test-${test.key}`}>
                        {busy === `test-${test.key}` ? 'Saving…' : 'Save test'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}

          <article className={`tech-check tech-check--${toneFor(engineKillTest.status)}`}>
            <header className="tech-check__head">
              <div>
                <h3>Engine kill / restore</h3>
                <p>Operations triggers the kill. You can only request the test — never perform it yourself, and never while the vehicle is moving.</p>
              </div>
              <span className={`tech-pill tech-pill--${toneFor(engineKillTest.status)}`}>{labelFor(engineKillTest.status)}</span>
            </header>

            {engineKillTest.requestedAt ? (
              <p className="tech-check__stamp">
                Requested {formatDateTime(engineKillTest.requestedAt)}{engineKillTest.requestNote ? ` · ${engineKillTest.requestNote}` : ''}
              </p>
            ) : null}
            {engineKillTest.verifiedAt ? (
              <p className="tech-check__stamp">
                Verified by {engineKillTest.verifiedByName || 'operations'} {formatDateTime(engineKillTest.verifiedAt)}
                {engineKillTest.restored === false ? ' · vehicle NOT restored' : ''}
              </p>
            ) : null}

            {!closed && engineKillTest.status === 'not_requested' ? (
              <form className="tech-check__form" onSubmit={requestKill}>
                <label className="tech-field tech-field--wide">
                  <span>Request note</span>
                  <input type="text" value={engineKillNote} onChange={(event) => setEngineKillNote(event.target.value)} placeholder="Vehicle stationary, ready for the test" />
                </label>
                <div className="tech-check__actions">
                  <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'kill'}>
                    {busy === 'kill' ? 'Sending…' : 'Request engine kill test'}
                  </button>
                </div>
              </form>
            ) : null}

            {engineKillTest.status === 'requested' ? (
              <p className="tech-note">Waiting for operations to coordinate and record the kill and restore result. You can still submit once the rest of the tests are done.</p>
            ) : null}
          </article>
        </div>
      </section>

      {!closed ? (
        <section className="tech-submit">
          <div>
            <h2>Submit for approval</h2>
            {missing.length ? (
              <p>Still needed: {missing.join(', ')}.</p>
            ) : (
              <p>Everything is recorded. Operations will review the portal readings and approve the installation.</p>
            )}
          </div>
          <button type="button" className="btn btn--primary" disabled={busy === 'submit' || submitted || missing.length > 0} onClick={submit}>
            {busy === 'submit' ? 'Submitting…' : submitted ? 'Submitted' : 'Submit installation'}
          </button>
        </section>
      ) : (
        <div className="tech-banner">
          <strong>{job.status === 'completed' ? 'Installation approved' : 'Installation cancelled'}</strong>
          <p>{job.status === 'completed' ? `Approved and completed${job.completedAt ? ` on ${formatDateTime(job.completedAt)}` : ''}.` : 'This installation was cancelled by the sales team.'}</p>
        </div>
      )}
    </div>
  );
}
