import { useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianInstallations, useTechnicianRemovals, useTechnicianStock } from '../../hooks/useTechnician.js';
import { confirmDeviceRemoval, searchRemovalVehicles } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const APPROVAL = { approved: ['ok', 'Approved'], pending: ['warn', 'Awaiting Operations'], rejected: ['warn', 'Sent back'], retest: ['warn', 'Retest asked'] };

/** Removal: pick the vehicle the device is coming off, confirm, and the device returns to this technician's stock. */
function RemovalPanel({ onClose, onDone }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState(null);
  const [imei, setImei] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (picked || q.trim().length < 2) { setFound([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchRemovalVehicles(q.trim(), { signal: controller.signal })
        .then((payload) => setFound(payload.data ?? []))
        .catch((err) => { if (err.name !== 'AbortError') setError(err.message); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, picked]);

  async function confirm() {
    setBusy(true); setError('');
    try {
      await confirmDeviceRemoval({ jobId: picked.jobId, imei: picked.imei ? undefined : imei.trim() });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tech-panel" aria-label="Remove a device">
      <div className="tech-panel__head">
        <h2>Remove a device</h2>
        <button type="button" className="btn btn--outline btn--small" onClick={onClose}>Close</button>
      </div>
      {error ? <p className="tech-alert" role="alert">{error}</p> : null}
      {!picked ? (
        <>
          <label className="field">
            <span>Vehicle registration, customer, phone or IMEI</span>
            <input className="input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="e.g. ABC-123" autoFocus />
          </label>
          {found.length ? (
            <ul className="tech-stock">
              {found.map((vehicle) => (
                <li key={vehicle.jobId} className="tech-stock__row">
                  <div>
                    <p className="tech-stock__id">{vehicle.registration}</p>
                    <p className="tech-stock__meta">{[vehicle.vehicleLabel, vehicle.customerName].filter(Boolean).join(' · ')}</p>
                    <p className="tech-stock__meta">{vehicle.imei ? `Device ${vehicle.imei}` : 'No device recorded'}{vehicle.simNumber ? ` · SIM ${vehicle.simNumber}` : ''}</p>
                  </div>
                  <button type="button" className="btn btn--primary btn--small" onClick={() => setPicked(vehicle)}>Select</button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? <p className="tech-state">No installed vehicle matches. Devices already removed are not listed.</p> : null}
        </>
      ) : (
        <>
          <dl className="tech-facts">
            <div><dt>Vehicle</dt><dd>{picked.registration}{picked.vehicleLabel ? ` · ${picked.vehicleLabel}` : ''}</dd></div>
            <div><dt>Customer</dt><dd>{picked.customerName || '—'}{picked.phone ? ` · ${picked.phone}` : ''}</dd></div>
            <div><dt>Device IMEI</dt><dd>{picked.imei || 'Not recorded'}</dd></div>
            <div><dt>SIM</dt><dd>{picked.simNumber || '—'}</dd></div>
          </dl>
          {!picked.imei ? (
            <label className="field">
              <span>IMEI of the device you removed</span>
              <input className="input" inputMode="numeric" value={imei} onChange={(event) => setImei(event.target.value)} />
            </label>
          ) : null}
          <p className="tech-state">Confirming adds this device to your stock and records the removal against you.</p>
          <div className="tech-panel__actions">
            <button type="button" className="btn btn--outline btn--small" onClick={() => setPicked(null)} disabled={busy}>Back</button>
            <button type="button" className="btn btn--primary btn--small" onClick={confirm} disabled={busy || (!picked.imei && !imei.trim())}>
              {busy ? 'Confirming…' : 'Confirm removal'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function History({ rows, empty, render }) {
  if (!rows.length) return <div className="tech-empty"><p>{empty}</p></div>;
  return <ul className="tech-stock">{rows.map(render)}</ul>;
}

export default function TechnicianStockPage() {
  useDocumentTitle('My stock');
  const [tab, setTab] = useState('stock');
  const [removing, setRemoving] = useState(false);
  const stock = useTechnicianStock();
  const installs = useTechnicianInstallations();
  const removals = useTechnicianRemovals();

  const devices = (stock.data?.devices ?? []).filter((device) => ['in_stock', 'assigned'].includes(device.status));
  const looseSims = (stock.data?.sims ?? []).filter((sim) => ['in_stock', 'assigned'].includes(sim.status) && !sim.pairedImei);
  const installations = installs.data ?? [];
  const removed = removals.data ?? [];
  const error = stock.error || installs.error || removals.error;

  const tabs = [
    ['stock', `In stock (${devices.length})`],
    ['installed', `Installed (${installations.length})`],
    ['removed', `Removed (${removed.length})`],
  ];

  function refreshAll() { stock.refresh(); installs.refresh(); removals.refresh(); }

  return (
    <div className="tech-page">
      <div className="tech-metrics tech-metrics--three">
        <div className="tech-metric"><span className="tech-metric__value">{devices.length}</span><span className="tech-metric__label">Devices in your stock</span></div>
        <div className="tech-metric"><span className="tech-metric__value">{installations.filter((row) => !row.removed).length}</span><span className="tech-metric__label">Installed on vehicles</span></div>
        <div className="tech-metric"><span className="tech-metric__value">{removed.length}</span><span className="tech-metric__label">Removed by you</span></div>
      </div>

      {removing ? (
        <RemovalPanel onClose={() => setRemoving(false)} onDone={() => { setRemoving(false); setTab('removed'); refreshAll(); }} />
      ) : (
        <button type="button" className="btn btn--outline" onClick={() => setRemoving(true)}>Remove a device from a vehicle</button>
      )}

      <div className="tech-filters" role="tablist" aria-label="Stock">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tech-filter${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {error ? (
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refreshAll}>Try again</button>
        </div>
      ) : null}

      {!error && tab === 'stock' ? (
        <>
          <History
            rows={devices}
            empty="No devices in your stock. Operations issues devices to you; a removed device comes back here."
            render={(device) => (
              <li key={device.id} className="tech-stock__row">
                <div>
                  <p className="tech-stock__id">{device.imei}</p>
                  <p className="tech-stock__meta">{device.simNumber ? `SIM ${device.simNumber}` : 'No SIM paired yet'}</p>
                </div>
                <div className="tech-stock__right">
                  <span className={`tech-pill tech-pill--${device.configured ? 'ok' : 'warn'}`}>{device.configured ? 'Configured' : 'Unconfigured'}</span>
                  {device.job ? <span className="tech-pill tech-pill--warn">Reserved for a job</span> : null}
                </div>
              </li>
            )}
          />
          {looseSims.length ? (
            <>
              <h3 className="tech-subhead">SIMs without a device</h3>
              <ul className="tech-stock">
                {looseSims.map((sim) => (
                  <li key={sim.id} className="tech-stock__row"><div><p className="tech-stock__id">{sim.number}</p><p className="tech-stock__meta">{sim.operator || 'Operator not recorded'}</p></div></li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      {!error && tab === 'installed' ? (
        <History
          rows={installations}
          empty="Nothing installed yet. A device appears here when you submit an installation."
          render={(row) => {
            const [tone, label] = APPROVAL[row.approval] ?? ['plain', row.approval];
            return (
              <li key={row.jobId} className="tech-stock__row">
                <div>
                  <p className="tech-stock__id">{row.registration}</p>
                  <p className="tech-stock__meta">IMEI {row.imei}{row.simNumber ? ` · SIM ${row.simNumber}` : ''}</p>
                  <p className="tech-stock__meta">{row.customerName}</p>
                </div>
                <div className="tech-stock__right">
                  {row.removed ? <span className="tech-pill tech-pill--plain">Removed</span> : <span className={`tech-pill tech-pill--${tone}`}>{label}</span>}
                  <span className="tech-stock__date">{formatDateTime(row.submittedAt)}</span>
                </div>
              </li>
            );
          }}
        />
      ) : null}

      {!error && tab === 'removed' ? (
        <History
          rows={removed}
          empty="No removals yet. Use “Remove a device from a vehicle” when you take a device off."
          render={(row) => (
            <li key={row.id} className="tech-stock__row">
              <div>
                <p className="tech-stock__id">{row.registration}</p>
                <p className="tech-stock__meta">IMEI {row.imei}{row.simNumber ? ` · SIM ${row.simNumber}` : ''}</p>
                <p className="tech-stock__meta">{row.customerName}</p>
              </div>
              <div className="tech-stock__right">
                <span className="tech-pill tech-pill--ok">{row.statusLabel}</span>
                <span className="tech-stock__date">{formatDateTime(row.removedAt)}</span>
              </div>
            </li>
          )}
        />
      ) : null}
    </div>
  );
}
