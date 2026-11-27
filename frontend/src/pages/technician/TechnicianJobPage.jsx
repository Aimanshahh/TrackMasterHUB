import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianJob } from '../../hooks/useTechnician.js';
import {
  markEngineKillUnsupported,
  requestEngineKillTest,
  runTechnicianPortalCheck,
  saveTechnicianTest,
  selectTechnicianStock,
  submitInstallationForReview,
} from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

function toneFor(status) {
  if (status === 'verified') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'requested' || status === 'not_supported') return 'warn';
  return 'plain';
}

function labelFor(status) {
  if (status === 'verified') return 'Verified';
  if (status === 'failed') return 'Failed';
  if (status === 'requested') return 'Requested';
  if (status === 'not_supported') return 'Not possible';
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
  const [place, setPlace] = useState('');
  const [engineKillNote, setEngineKillNote] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!job) return;
    setImei(job.deviceImei ?? '');
    setSimNumber(job.simNumber ?? '');
    setPlace(job.testing?.location?.physicalLocation ?? '');
  }, [job?.deviceImei, job?.simNumber, job?.id]);

  const closed = job ? ['completed', 'cancelled'].includes(job.status) : false;
  const submitted = Boolean(job?.testing?.submittedAt) && job?.testing?.review?.status === 'pending';

  const missing = useMemo(() => {
    if (!job) return [];
    const t = job.testing ?? {};
    const list = [];
    if (!job.deviceImei || !job.simNumber) list.push('select your device and SIM');
    if (t.battery?.status !== 'verified') list.push('battery disconnect check');
    if (t.ignition?.status !== 'verified') list.push('ignition ON/OFF check');
    if (t.location?.status !== 'verified') list.push('geolocation check');
    if (t.engineKillApplicable && !['requested', 'verified', 'not_supported'].includes(t.engineKillTest?.status)) list.push('engine kill');
    return list;
  }, [job]);

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

  async function checkNow() {
    const ok = await run('portal', () => runTechnicianPortalCheck(id));
    if (ok) setMessage({ tone: 'ok', text: 'Read from the tracking portal.' });
  }

  async function saveLocation(event) {
    event.preventDefault();
    const ok = await run('location', () => saveTechnicianTest(id, { location: { physicalLocation: place } }));
    if (ok) setMessage({ tone: 'ok', text: 'Fitting location saved.' });
  }

  async function saveManual(key, status) {
    const ok = await run(`manual-${key}`, () => saveTechnicianTest(id, { [key]: { status, note: 'Not exposed by the portal for this device' } }));
    if (ok) setMessage({ tone: 'ok', text: 'Recorded manually because the portal does not report it for this device.' });
  }

  async function cannotKill(event) {
    event.preventDefault();
    const ok = await run('unsupported', () => markEngineKillUnsupported(id, { note: engineKillNote }));
    if (ok) { setEngineKillNote(''); setMessage({ tone: 'ok', text: 'Noted. Operations will see that this vehicle cannot take an engine kill.' }); }
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

      <section className="tech-section">
        <div className="tech-section__head">
          <h2>Installation tests</h2>
          <span className="tech-section__asof">
            {job.testing?.portalCheck?.at ? `read ${formatDateTime(job.testing.portalCheck.at)}` : 'not read yet'}
          </span>
        </div>
        <p className="tech-section__lead">
          Location, ignition and battery disconnect are read straight from the tracking portal using the IMEI above. Operations creates the device on the portal; you switch the ignition and disconnect the battery, then tap Check now after each change.
        </p>

        {!closed ? (
          <button type="button" className="btn btn--primary tech-checknow" onClick={checkNow} disabled={busy === 'portal' || !job.deviceImei}>
            {busy === 'portal' ? 'Reading the portal…' : 'Check now'}
          </button>
        ) : null}
        {job.testing?.portalCheck?.message ? <p className="tech-note">{job.testing.portalCheck.message}</p> : null}

        {telemetry?.found ? (
          <dl className="tech-telemetry">
            <div><dt>Last report</dt><dd>{telemetry.lastSeenAt ? formatDateTime(telemetry.lastSeenAt) : 'never'}</dd></div>
            <div><dt>Ignition</dt><dd><TelemetryValue value={telemetry.ignitionOn === null ? null : telemetry.ignitionOn ? 'ON' : 'OFF'} /></dd></div>
            <div><dt>Battery</dt><dd><TelemetryValue value={telemetry.batteryConnected === null ? null : telemetry.batteryConnected ? 'connected' : 'disconnected'} /></dd></div>
            <div><dt>Position</dt><dd>{telemetry.latitude !== null && telemetry.longitude !== null ? `${telemetry.latitude}, ${telemetry.longitude}` : <span className="tech-telemetry__none">not reported</span>}</dd></div>
          </dl>
        ) : null}

        <div className="tech-checklist">
          <article className={`tech-check tech-check--${toneFor(job.testing?.battery?.status)}`}>
            <header className="tech-check__head">
              <div>
                <h3>Battery disconnect</h3>
                <p>Disconnect the vehicle battery, check, then reconnect it and check again. The portal must see both.</p>
              </div>
              <span className={`tech-pill tech-pill--${toneFor(job.testing?.battery?.status)}`}>{labelFor(job.testing?.battery?.status)}</span>
            </header>
            <ul className="tech-seen">
              <li className={job.testing?.battery?.seenDisconnected ? 'is-done' : ''}>Disconnected seen</li>
              <li className={job.testing?.battery?.seenConnected ? 'is-done' : ''}>Reconnected seen</li>
            </ul>
            {!closed && telemetry?.found && telemetry.batteryConnected === null && job.testing?.battery?.status !== 'verified' ? (
              <div className="tech-check__actions">
                <button type="button" className="btn btn--outline btn--small" disabled={busy === 'manual-battery'} onClick={() => saveManual('battery', 'verified')}>Portal does not report it — passed</button>
              </div>
            ) : null}
          </article>

          <article className={`tech-check tech-check--${toneFor(job.testing?.ignition?.status)}`}>
            <header className="tech-check__head">
              <div>
                <h3>Ignition ON / OFF</h3>
                <p>Turn the ignition ON, check, then OFF and check again.</p>
              </div>
              <span className={`tech-pill tech-pill--${toneFor(job.testing?.ignition?.status)}`}>{labelFor(job.testing?.ignition?.status)}</span>
            </header>
            <ul className="tech-seen">
              <li className={job.testing?.ignition?.seenOn ? 'is-done' : ''}>ON seen</li>
              <li className={job.testing?.ignition?.seenOff ? 'is-done' : ''}>OFF seen</li>
            </ul>
            {!closed && telemetry?.found && telemetry.ignitionOn === null && job.testing?.ignition?.status !== 'verified' ? (
              <div className="tech-check__actions">
                <button type="button" className="btn btn--outline btn--small" disabled={busy === 'manual-ignition'} onClick={() => saveManual('ignition', 'verified')}>Portal does not report it — passed</button>
              </div>
            ) : null}
          </article>

          <article className={`tech-check tech-check--${toneFor(job.testing?.location?.status)}`}>
            <header className="tech-check__head">
              <div>
                <h3>Geolocation</h3>
                <p>The portal must report a position. Add where the device was fitted in the vehicle.</p>
              </div>
              <span className={`tech-pill tech-pill--${toneFor(job.testing?.location?.status)}`}>{labelFor(job.testing?.location?.status)}</span>
            </header>
            <ul className="tech-seen">
              <li className={job.testing?.location?.gpsReceived ? 'is-done' : ''}>Position received</li>
              <li className={job.testing?.location?.physicalLocation ? 'is-done' : ''}>Fitting place added</li>
            </ul>
            {!closed ? (
              <form className="tech-check__form" onSubmit={saveLocation}>
                <label className="tech-field tech-field--wide">
                  <span>Where the device was fitted</span>
                  <input type="text" value={place} onChange={(event) => setPlace(event.target.value)} placeholder="e.g. behind the glovebox" />
                </label>
                <div className="tech-check__actions">
                  <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'location' || !place.trim()}>
                    {busy === 'location' ? 'Saving…' : 'Save place'}
                  </button>
                </div>
              </form>
            ) : null}
          </article>

          <article className={`tech-check tech-check--${job.testing?.engineKillApplicable ? toneFor(engineKillTest.status) : 'plain'}`}>
            <header className="tech-check__head">
              <div>
                <h3>Engine kill</h3>
                <p>
                  {job.testing?.engineKillApplicable
                    ? 'Call Operations to test it while the vehicle is stationary. Operations checks it on the portal.'
                    : `The ${job.packageName || 'selected'} package does not include an engine kill.`}
                </p>
              </div>
              <span className={`tech-pill tech-pill--${job.testing?.engineKillApplicable ? toneFor(engineKillTest.status) : 'plain'}`}>
                {job.testing?.engineKillApplicable ? labelFor(engineKillTest.status) : 'Not in package'}
              </span>
            </header>

            {engineKillTest.requestedAt ? (
              <p className="tech-check__stamp">
                {engineKillTest.status === 'not_supported' ? 'Reported' : 'Requested'} {formatDateTime(engineKillTest.requestedAt)}{engineKillTest.requestNote ? ` · ${engineKillTest.requestNote}` : ''}
              </p>
            ) : null}
            {engineKillTest.verifiedAt ? (
              <p className="tech-check__stamp">Verified by {engineKillTest.verifiedByName || 'operations'} {formatDateTime(engineKillTest.verifiedAt)}</p>
            ) : null}

            {!closed && job.testing?.engineKillApplicable && ['not_requested', 'failed'].includes(engineKillTest.status) ? (
              <form className="tech-check__form" onSubmit={requestKill}>
                <label className="tech-field tech-field--wide">
                  <span>Note</span>
                  <input type="text" value={engineKillNote} onChange={(event) => setEngineKillNote(event.target.value)} placeholder="Request note, or why this vehicle cannot take one" />
                </label>
                <div className="tech-check__actions">
                  <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'kill'}>
                    {busy === 'kill' ? 'Sending…' : 'I called Operations — request test'}
                  </button>
                  <button type="button" className="btn btn--outline btn--small" disabled={busy === 'unsupported' || !engineKillNote.trim()} onClick={cannotKill}>
                    Vehicle cannot take engine kill
                  </button>
                </div>
              </form>
            ) : null}

            {engineKillTest.status === 'requested' ? (
              <p className="tech-note">Waiting for Operations to test it. You can submit once the other checks are done.</p>
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
