import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useVehicles } from '../../hooks/useVehicles.js';
import { formatDateTime } from '../../lib/format.js';

const FILTERS = [
  { value: '', label: 'All vehicles', count: 'total' },
  { value: 'active', label: 'Active', count: 'active' },
  { value: 'inactive', label: 'Inactive', count: 'inactive' },
  { value: 'not_tracked', label: 'Not on tracking server', count: 'not_tracked' },
  { value: 'unknown', label: 'Unknown', count: 'unknown' },
];

const STATUS_TAGS = {
  active: { label: 'Active', tone: 'paid' },
  inactive: { label: 'Inactive', tone: 'overdue' },
  not_tracked: { label: 'Not on tracker', tone: 'partial' },
  unknown: { label: 'Unknown', tone: 'muted' },
};

const GPS_STATE_LABELS = { online: 'Moving', ack: 'Connected', engine: 'Ignition on', offline: 'Offline' };

function timeAgo(value) {
  if (!value) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function SyncBanner({ sync }) {
  if (!sync) return null;

  if (!sync.configured) {
    return (
      <p className="app-notice app-notice--error" role="status">
        The tracking server is not connected yet, so live status is unavailable. Ask your administrator to set the TRACKING_* values on the backend.
      </p>
    );
  }
  if (sync.error) {
    return (
      <p className="app-notice app-notice--error" role="alert">
        The last attempt to read the tracking server failed: {sync.error}
        {sync.syncedAt ? ` Showing status from ${timeAgo(sync.syncedAt)}.` : ' No status has been loaded yet.'}
      </p>
    );
  }
  if (sync.stale) {
    return <p className="app-notice app-notice--error" role="status">Status is out of date: last synced {timeAgo(sync.syncedAt)}.</p>;
  }
  return null;
}

/**
 * Installed vehicles joined with live status from the tracking server. Shared
 * by the Manager and Admin workspaces. A status is only shown when the tracking
 * server actually reported it; otherwise the row says so.
 */
export default function VehicleRecordsPage() {
  useDocumentTitle('Vehicles');
  const { user } = useAuth();
  const customerBase = user?.role === 'admin' ? '/admin/customers' : '/manager/customers';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const vehicles = useVehicles({ q: search, status: filter });
  const counts = vehicles.meta?.counts ?? {};
  const sync = vehicles.meta?.sync;

  return (
    <div className="vehicles-page">
      <div className="lookup-bar">
        <div className="lookup-bar__field">
          <span className="lookup-bar__label">Find a vehicle</span>
          <input
            className="input"
            aria-label="Search vehicles"
            placeholder="Registration, customer, phone, IMEI or SIM…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="button" className="btn btn--outline btn--small" onClick={vehicles.refreshStatus} disabled={vehicles.refreshing || !sync?.configured}>
          {vehicles.refreshing ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>

      <div className="sp-chips" role="group" aria-label="Filter by status">
        {FILTERS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            className={`sp-chip${filter === option.value ? ' is-active' : ''}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}{counts[option.count] !== undefined ? ` · ${counts[option.count]}` : ''}
          </button>
        ))}
      </div>

      <SyncBanner sync={sync} />
      {vehicles.error ? <p className="app-notice app-notice--error" role="alert">Vehicles are unavailable: {vehicles.error}</p> : null}
      {vehicles.status === 'loading' ? <p className="data-state" role="status">Loading vehicles…</p> : null}

      {vehicles.status !== 'loading' && !vehicles.error && vehicles.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{search || filter ? 'No vehicle matches this filter' : 'No installed vehicles yet'}</h2>
          <p>{search || filter ? 'Clear the search or choose another status.' : 'A vehicle appears here once operations marks its installation completed.'}</p>
        </div>
      ) : null}

      {vehicles.rows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col">Customer</th>
                <th scope="col">Device</th>
                <th scope="col">Installed</th>
                <th scope="col">Status</th>
                <th scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.rows.map((row) => {
                const tag = STATUS_TAGS[row.tracking.status] ?? STATUS_TAGS.unknown;
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="ledger__strong">{row.vehicle.registration || '—'}</span>
                      <span className="ledger__sub">{row.vehicle.label || 'No name recorded'}</span>
                    </td>
                    <td>
                      {row.customer.id ? (
                        <Link className="ledger__link" to={`${customerBase}/${row.customer.id}`}>{row.customer.name || 'Customer'}</Link>
                      ) : (
                        <span className="ledger__strong">{row.customer.name || 'Customer'}</span>
                      )}
                      <span className="ledger__sub">{row.customer.phone || 'No phone'}</span>
                    </td>
                    <td>
                      <span className="ledger__strong">{row.deviceImei || 'No IMEI'}</span>
                      <span className="ledger__sub">{row.simNumber || 'No SIM'}</span>
                    </td>
                    <td>
                      <span className="ledger__muted">{row.installedAt ? new Date(row.installedAt).toLocaleDateString('en-GB') : '—'}</span>
                      <span className="ledger__sub">{[row.vehicle.station, row.packageName].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>
                      <span className="state-tag" data-state={tag.tone}>{tag.label}</span>
                      {row.tracking.gpsState ? (
                        <span className="ledger__sub">{GPS_STATE_LABELS[row.tracking.gpsState] ?? row.tracking.gpsState}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="ledger__muted">{row.tracking.lastSeenAt ? timeAgo(row.tracking.lastSeenAt) : '—'}</span>
                      <span className="ledger__sub">{row.tracking.lastSeenAt ? formatDateTime(row.tracking.lastSeenAt) : ''}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ledger-note">
        Matched to the tracking server by registration number. A vehicle is Inactive when it is offline or has sent no data for
        {' '}{sync?.inactiveAfterHours ?? 24} hours. “Not on tracker” means no device with that registration was found on the tracking server,
        usually a spelling difference in the registration. {sync?.syncedAt ? `Last synced ${timeAgo(sync.syncedAt)}.` : ''}
      </p>
    </div>
  );
}
