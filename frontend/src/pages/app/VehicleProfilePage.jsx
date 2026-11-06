import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { engineKillLabel } from '../../app/installation.js';
import { formatDayTime } from '../../app/operations.js';
import { EngineKillBadge, EngineKillDrawer } from '../../components/operations/EngineKill.jsx';
import InstallationHistory, { ChecklistChips } from '../../components/operations/InstallationHistory.jsx';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchVehicleProfile } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const TRACK = { active: ['Active', 'paid'], inactive: ['Inactive', 'overdue'], not_tracked: ['Not on tracker', 'partial'], unknown: ['Unknown', 'muted'] };

function Fact({ label, children }) {
  return <div className="vp-fact"><span>{label}</span><strong>{children || '—'}</strong></div>;
}

/** One vehicle: customer, device, engine kill (with its history) and every installation record. Shared by admin, manager and operations. */
export default function VehicleProfilePage() {
  useDocumentTitle('Vehicle');
  const { id } = useParams();
  const { user } = useAuth();
  const base = user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/operations';
  const canEditEngineKill = user?.role === 'admin' || user?.role === 'operations';
  const canOpenCustomer = user?.role !== 'operations';

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async (signal) => {
    try {
      const payload = await fetchVehicleProfile(id, { signal });
      setState({ status: 'ready', data: payload.data, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message });
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (state.status === 'loading') return <p className="data-state" role="status">Loading vehicle…</p>;
  if (state.status === 'error') return <p className="app-notice app-notice--error" role="alert">{state.error} <Link to={`${base}/vehicles`}>Back to vehicles</Link></p>;

  const { vehicle, customer, device, engineKill, engineKillHistory, tracking, installations, serviceJobs, certificates } = state.data;
  const [trackLabel, trackTone] = TRACK[tracking?.status] ?? TRACK.unknown;

  return (
    <div className="vp">
      <Link className="vp__back" to={`${base}/vehicles`}>← All vehicles</Link>

      <header className="vp__hero">
        <div>
          <p className="vp__eyebrow">{vehicle.label || 'Vehicle'}</p>
          <h2 className="vp__plate">{vehicle.registration || 'No registration'}</h2>
          <p className="vp__owner">
            {canOpenCustomer && customer.id ? <Link to={`${base}/customers/${customer.id}`}>{customer.name}</Link> : customer.name}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </p>
        </div>
        <div className="vp__badges">
          <div><span>Tracking</span><span className="state-tag" data-state={trackTone}>{trackLabel}</span></div>
          <div><span>Engine kill</span><EngineKillBadge status={engineKill.status} label={engineKill.label} /></div>
        </div>
      </header>

      <div className="vp__grid">
        <section className="panel">
          <div className="panel__head"><h3 className="panel__title">Vehicle</h3></div>
          <div className="panel__body vp-facts">
            <Fact label="Engine number">{vehicle.engineNo}</Fact>
            <Fact label="Chassis number">{vehicle.chassisNo}</Fact>
            <Fact label="Colour">{vehicle.colour}</Fact>
            <Fact label="Station">{vehicle.station}</Fact>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head"><h3 className="panel__title">Device &amp; SIM</h3></div>
          <div className="panel__body vp-facts">
            <Fact label="IMEI">{device.imei}</Fact>
            <Fact label="SIM number">{device.simNumber}</Fact>
            <Fact label="Model">{device.model}</Fact>
            <Fact label="Fitted at">{device.placement}</Fact>
          </div>
        </section>

        <section className="panel vp__wide">
          <div className="panel__head">
            <div>
              <h3 className="panel__title">Engine kill</h3>
              <p className="panel__meta">Kept separate from the GPS installation. Every change is recorded.</p>
            </div>
            {canEditEngineKill ? <button type="button" className="btn btn--outline btn--small" onClick={() => setEditing(true)}>Update status</button> : null}
          </div>
          <div className="panel__body">
            <p className="vp__ek-now"><EngineKillBadge status={engineKill.status} label={engineKill.label} />
              {engineKill.reason ? <span> {engineKill.reason}</span> : null}
              {engineKill.updatedAt ? <small> · {formatDateTime(engineKill.updatedAt)}{engineKill.updatedBy ? ` by ${engineKill.updatedBy}` : ''}</small> : null}
            </p>
            {engineKillHistory.length ? (
              <ol className="vp-ek-history">
                {engineKillHistory.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span>{engineKillLabel(entry.from)} → <strong>{entry.toLabel}</strong>{entry.reason ? ` — ${entry.reason}` : ''}</span>
                    <time dateTime={entry.at}>{formatDayTime(entry.at)}{entry.byName ? ` · ${entry.byName}` : ''}</time>
                  </li>
                ))}
              </ol>
            ) : <p className="field__hint">No engine kill change has been recorded for this vehicle yet.</p>}
          </div>
        </section>
      </div>

      <h3 className="vp__h">Installation records</h3>
      {installations.map((job) => (
        <section className="panel vp-install" key={job.id}>
          <div className="panel__head">
            <div>
              <h4 className="panel__title">{job.reference} · {job.statusLabel}</h4>
              <p className="panel__meta">
                {job.completedAt ? `Completed ${formatDateTime(job.completedAt)}` : 'Not completed yet'}
                {job.technician?.name ? ` · Technician ${job.technician.name}` : ''}
              </p>
            </div>
          </div>
          <div className="panel__body vp-install__body">
            <div className="vp-facts">
              <Fact label="Installation address">{job.installation.address}</Fact>
              <Fact label="Device location">{job.installation.placement}</Fact>
              <Fact label="Device model">{job.installation.deviceModel}</Fact>
              <Fact label="Battery temperature">{job.installation.batteryTemperatureC === null ? '' : `${job.installation.batteryTemperatureC} °C`}</Fact>
              <Fact label="Testing results">{job.installation.testResult}</Fact>
              <Fact label="Technician remarks">{job.installation.technicianRemarks}</Fact>
              <Fact label="Operations remarks">{job.installation.operationsRemarks}</Fact>
            </div>
            <ChecklistChips checklist={job.installation.checklist} />
            <details className="vp-install__history">
              <summary>Installation history ({job.history.length})</summary>
              <InstallationHistory history={job.history} />
            </details>
          </div>
        </section>
      ))}

      {serviceJobs.length ? (
        <>
          <h3 className="vp__h">Service history</h3>
          <section className="panel"><ul className="vp-list">
            {serviceJobs.map((job) => <li key={job.id}><strong>{job.reference} · {job.statusLabel}</strong><span>{job.notes || 'Follow-up visit'}</span><time>{formatDayTime(job.createdAt)}</time></li>)}
          </ul></section>
        </>
      ) : null}

      {certificates.length ? (
        <>
          <h3 className="vp__h">Certificates</h3>
          <section className="panel"><ul className="vp-list">
            {certificates.map((c) => <li key={c.id}><strong>{c.number}</strong><span>{c.status === 'active' ? 'Active' : c.status === 'cancelled' ? 'Cancelled' : 'Replaced'}</span><time>{formatDateTime(c.issuedAt)}</time></li>)}
          </ul></section>
        </>
      ) : null}

      {editing ? <EngineKillDrawer jobId={state.data.id} current={engineKill} onClose={() => setEditing(false)} onSaved={() => load()} /> : null}
    </div>
  );
}
