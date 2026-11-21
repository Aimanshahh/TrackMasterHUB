import { useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../operations/OpsStatus.jsx';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/**
 * Every vehicle of one customer in a single compact table. A row opens the
 * full vehicle record through onOpen, so the profile page stays short even
 * for a fleet customer with dozens of vehicles.
 */
export default function CustomerVehiclesDrawer({ customerName, vehicles, onClose, onOpen }) {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((job) => [
      job.vehicle?.registration, job.vehicle?.label, job.deviceImei, job.simNumber, job.loginId,
    ].some((part) => String(part ?? '').toLowerCase().includes(needle)));
  }, [vehicles, filter]);

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={`Vehicles of ${customerName}`}>
      <button type="button" className="drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="drawer drawer--wide">
        <header className="drawer__head">
          <div>
            <h2>Vehicles</h2>
            <p>{customerName} · {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}</p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={onClose}>Close</button>
        </header>
        <div className="drawer__body">
          {vehicles.length > 6 ? (
            <input
              className="input vehicles-drawer__filter"
              type="search"
              placeholder="Filter by VRN, IMEI or SIM"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter vehicles"
            />
          ) : null}
          <div className="ledger-wrap">
            <table className="ledger vehicles-table">
              <thead>
                <tr>
                  <th>VRN</th>
                  <th>Vehicle</th>
                  <th>Device IMEI</th>
                  <th>Installed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr key={job.id} className="vehicles-table__row" tabIndex={0} onClick={() => onOpen(job)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(job); }}>
                    <td><strong>{job.vehicle?.registration || '—'}</strong></td>
                    <td>{job.vehicle?.label || '—'}</td>
                    <td className="mono">{job.deviceImei || '—'}</td>
                    <td>{formatDay(job.installationDate)}</td>
                    <td><StatusPill status={job.status} label={job.statusLabel} /></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5}>No vehicle matches that filter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  );
}
