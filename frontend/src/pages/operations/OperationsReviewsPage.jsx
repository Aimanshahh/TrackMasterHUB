import { useCallback, useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  fetchTestingReviews,
  refreshInstallationReview,
  reviewInstallation,
  updateInstallationSchedule,
} from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const TEST_ROWS = [
  ['battery', 'Battery disconnect'],
  ['ignition', 'Ignition ON/OFF'],
  ['location', 'Installation geolocation'],
  ['engineKill', 'Engine kill / restore'],
];

function tone(status) {
  if (status === 'verified') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'requested' || status === 'not_supported') return 'warn';
  return 'plain';
}

function label(status) {
  if (status === 'verified') return 'Verified';
  if (status === 'failed') return 'Failed';
  if (status === 'requested') return 'Requested';
  if (status === 'not_supported') return 'Cannot fit';
  return 'Not done';
}

export default function OperationsReviewsPage() {
  useDocumentTitle('Testing review');
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  const [activated, setActivated] = useState(true);
  const [restored, setRestored] = useState(true);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleReason, setScheduleReason] = useState('');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchTestingReviews({ signal });
      setState({ status: 'ready', rows: payload.data ?? [], meta: payload.meta ?? null, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = state.rows.find((row) => row.id === selectedId) ?? state.rows.find((row) => row.testing.review.status === 'pending') ?? state.rows[0];

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setScheduleAt(selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : '');
    setNote('');
    setFeedback(null);
  }, [selected?.id]);

  async function decide(decision) {
    if (!selected) return;
    setBusy(decision);
    setFeedback(null);
    try {
      await reviewInstallation(selected.id, { decision, note, activated, restored });
      setNote('');
      await load();
      setFeedback({ tone: 'ok', text: decision === 'approve' ? 'Installation approved. The technician earning was created from their rate.' : 'Sent back to the technician.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function refreshPortal() {
    if (!selected) return;
    setBusy('refresh');
    setFeedback(null);
    try {
      await refreshInstallationReview(selected.id);
      await load();
      setFeedback({ tone: 'ok', text: 'Portal readings refreshed.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function saveSchedule(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy('schedule');
    setFeedback(null);
    try {
      await updateInstallationSchedule(selected.id, {
        scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : null,
        reason: scheduleReason,
      });
      setScheduleReason('');
      await load();
      setFeedback({ tone: 'ok', text: 'Schedule updated and the technician was notified.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="field-page">
      <div className="field-strip">
        <div><span>Submitted</span><strong>{state.meta?.total ?? 0}</strong></div>
        <div><span>Awaiting review</span><strong>{state.meta?.awaitingReview ?? 0}</strong></div>
        <div><span>Selected</span><strong>{selected?.reference ?? '—'}</strong></div>
      </div>

      {state.error ? (
        <div className="field-alert" role="alert">
          <p>{state.error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={() => load()}>Try again</button>
        </div>
      ) : null}

      {state.status === 'loading' ? <p className="data-state">Loading submitted installations…</p> : null}

      {!state.error && state.status !== 'loading' && !state.rows.length ? (
        <div className="field-empty">
          <p className="field-empty__title">Nothing submitted yet</p>
          <p>When a technician finishes the four installation tests and submits, the installation appears here with their readings for you to verify against the tracking portal.</p>
        </div>
      ) : null}

      {state.rows.length ? (
        <div className="field-split">
          <ul className="field-list">
            {state.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`field-list__item${selected?.id === row.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="field-list__ref">{row.reference}</span>
                  <span className="field-list__name">{row.customerName}</span>
                  <span className="field-list__meta">
                    {row.vehicle.registration || 'No registration'} · {row.technician?.name ?? 'No technician'}
                  </span>
                  <span className={`field-chip field-chip--${row.status === 'completed' ? 'ok' : row.testing.review.status === 'pending' ? 'warn' : 'plain'}`}>
                    {row.status === 'completed' ? 'Approved' : row.testing.review.status === 'pending' ? 'Awaiting review' : label(row.testing.review.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <section className="field-detail">
              <header className="field-detail__head">
                <div>
                  <p className="field-detail__ref">{selected.reference}</p>
                  <h2>{selected.customerName}</h2>
                  <p className="field-detail__meta">
                    {selected.vehicle.label || 'Vehicle'} · {selected.vehicle.registration || 'no registration'} · {selected.vehicle.station || 'no station'}
                  </p>
                </div>
                <span className="field-detail__package">{selected.packageName || 'No package'}</span>
              </header>

              {feedback ? (
                <div className={`field-message field-message--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
                  {feedback.text}
                </div>
              ) : null}

              <dl className="field-facts">
                <div><dt>Technician</dt><dd>{selected.technician?.name ?? 'Unassigned'}</dd></div>
                <div><dt>Submitted</dt><dd>{selected.testing.submittedAt ? formatDateTime(selected.testing.submittedAt) : 'Not submitted'}</dd></div>
                <div><dt>IMEI</dt><dd>{selected.deviceImei || '—'}</dd></div>
                <div><dt>SIM</dt><dd>{selected.simNumber || '—'}</dd></div>
                <div><dt>Address</dt><dd>{selected.address || '—'}</dd></div>
                <div><dt>Microphone</dt><dd>{selected.microphone.required ? selected.microphone.number || 'Required, not assigned' : 'Not included'}</dd></div>
              </dl>

              <table className="field-table">
                <thead><tr><th>Test</th><th>Technician</th><th>Operations</th></tr></thead>
                <tbody>
                  {TEST_ROWS.map(([key, title]) => (
                    <tr key={key}>
                      <td>{title}</td>
                      <td><span className={`field-chip field-chip--${tone(selected.testing[key])}`}>{label(selected.testing[key])}</span></td>
                      <td className="field-table__muted">
                        {key === 'engineKill'
                          ? !selected.testing.engineKillApplicable ? 'Not in this package'
                            : selected.testing[key] === 'not_supported' ? `Technician: cannot fit${selected.testing.engineKillNote ? ` — ${selected.testing.engineKillNote}` : ''}`
                            : selected.testing[key] === 'verified' ? 'Recorded by operations' : 'Test with the technician, check the portal, then approve'
                          : 'Checked against the portal reading'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selected.telemetry ? (
                <section className="field-telemetry">
                  <h3>Tracking portal</h3>
                  <button type="button" className="btn btn--outline btn--small" disabled={busy === 'refresh'} onClick={refreshPortal}>
                    {busy === 'refresh' ? 'Reading…' : 'Refresh from portal'}
                  </button>
                  {selected.telemetry.found ? (
                    <dl>
                      <div><dt>Connection</dt><dd>{selected.telemetry.gpsState || 'unknown'}</dd></div>
                      <div><dt>Last report</dt><dd>{selected.telemetry.lastSeenAt ? formatDateTime(selected.telemetry.lastSeenAt) : 'never'}</dd></div>
                      <div><dt>Ignition</dt><dd>{selected.telemetry.ignitionOn === null ? 'not reported' : selected.telemetry.ignitionOn ? 'ON' : 'OFF'}</dd></div>
                      <div><dt>Battery</dt><dd>{selected.telemetry.batteryConnected === null ? 'not reported' : selected.telemetry.batteryConnected ? 'connected' : 'disconnected'}</dd></div>
                      <div><dt>Position</dt><dd>{selected.telemetry.latitude !== null && selected.telemetry.longitude !== null ? `${selected.telemetry.latitude}, ${selected.telemetry.longitude}` : 'not reported'}</dd></div>
                    </dl>
                  ) : (
                    <p className="field-note">{selected.telemetry.error || 'This device is not listed on the tracking portal.'}</p>
                  )}
                </section>
              ) : null}

              {selected.status !== 'completed' ? (
                <section className="field-review">
                  <h3>Decision</h3>

                  {selected.suggestedLogin ? (
                    <p className="field-note">Customer app login created on approval: <strong>{selected.suggestedLogin}</strong></p>
                  ) : null}

                  <div className="field-engine-kill" hidden={!selected.testing.engineKillApplicable || selected.testing.engineKill === 'not_supported'}>
                    <label><input type="checkbox" checked={activated} onChange={(event) => setActivated(event.target.checked)} /> Engine kill activated</label>
                    <label><input type="checkbox" checked={restored} onChange={(event) => setRestored(event.target.checked)} /> Vehicle restored</label>
                    <p className="field-note">Only test the engine kill with the vehicle stationary. A test that was not restored blocks approval.</p>
                  </div>

                  <label className="field-field">
                    <span>Note to the technician</span>
                    <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required when rejecting or requesting a retest" />
                  </label>

                  <div className="field-actions">
                    <button type="button" className="btn btn--primary btn--small" disabled={busy === 'approve'} onClick={() => decide('approve')}>
                      {busy === 'approve' ? 'Approving…' : 'Approve installation'}
                    </button>
                    <button type="button" className="btn btn--outline btn--small" disabled={busy === 'retest'} onClick={() => decide('retest')}>Request retest</button>
                    <button type="button" className="btn btn--ghost btn--small" disabled={busy === 'reject'} onClick={() => decide('reject')}>Reject</button>
                  </div>
                </section>
              ) : null}

              {selected.status !== 'completed' ? (
                <form className="field-schedule" onSubmit={saveSchedule}>
                  <h3>Reschedule</h3>
                  <div className="field-row">
                    <label className="field-field">
                      <span>Installation date &amp; time</span>
                      <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
                    </label>
                    <label className="field-field">
                      <span>Reason</span>
                      <input type="text" value={scheduleReason} onChange={(event) => setScheduleReason(event.target.value)} placeholder="Customer asked for a later slot" />
                    </label>
                  </div>
                  <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'schedule'}>
                    {busy === 'schedule' ? 'Saving…' : 'Update schedule'}
                  </button>
                  <p className="field-note">Every change is kept with its previous value and the technician is notified.</p>
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
