import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useVehicles } from '../../hooks/useVehicles.js';
import { formatDateTime } from '../../lib/format.js';
import { exportPendingInspections } from '../../lib/api.js';
import ComplaintDrawer from '../../components/salesperson/ComplaintDrawer.jsx';
import VehicleInspectionModal from '../../components/vehicles/VehicleInspectionModal.jsx';
import { getAmcStatus } from '../../utils/amcStatus.js';

const STATUS_TAGS = {
  active: { label: 'Active', tone: 'paid' },
  inactive: { label: 'Inactive', tone: 'overdue' },
  not_tracked: { label: 'Not on tracker', tone: 'muted' },
  unknown: { label: 'Not on tracker', tone: 'muted' },
};

const GPS_STATE_LABELS = { online: 'Moving', ack: 'Connected', engine: 'Ignition on', offline: 'Offline' };
const AMC_FILTERS = [
  { value: '', label: 'All AMC' },
  { value: 'Active', label: 'Active' },
  { value: 'Expiring Soon', label: 'Expiring Soon' },
  { value: 'Active (No Tracker)', label: 'Active (No Tracker)' },
  { value: 'Expired', label: 'Expired' },
];
const PORTAL_FILTERS = ['', 'Portal 1', 'Portal 2'];
const SORT_OPTIONS = [
  { value: 'registration', label: 'Registration' },
  { value: 'customer', label: 'Customer' },
  { value: 'installed', label: 'Installation date' },
  { value: 'amc', label: 'AMC expiry date' },
  { value: 'lastSeen', label: 'Last seen' },
  { value: 'urgency', label: 'AMC urgency' },
];

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
  const base = user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/operations';
  const customerBase = `${base}/customers`;
  const canOpenCustomer = user?.role !== 'operations';
  const canRefresh = user?.role !== 'operations';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [amcFilter, setAmcFilter] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [physicalFilter, setPhysicalFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('');
  const [sortBy, setSortBy] = useState('registration');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [complaintVehicle, setComplaintVehicle] = useState(null);
  const [inspectionVehicle, setInspectionVehicle] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const vehicles = useVehicles({ q: search, status: filter });
  const counts = vehicles.meta?.counts ?? {};
  const amcCounts = vehicles.meta?.amcCounts ?? {};
  const sync = vehicles.meta?.sync;
  const searchRequired = user?.role === 'operations';
  const filteredRows = useMemo(() => {
    const rows = vehicles.rows
      .filter((row) => !portalFilter || (row.portalSource || 'Unassigned') === portalFilter)
      .filter((row) => !physicalFilter || row.physicalStatus === physicalFilter)
      .filter((row) => {
        const label = getAmcStatus(row.amcExpiryDate ?? row.tracking?.amcExpiryDate, row.tracking?.status).label;
        return !amcFilter || label === amcFilter;
      });
    const value = (row) => {
      if (sortBy === 'customer') return row.customer.name || '';
      if (sortBy === 'installed') return row.installedAt || '';
      if (sortBy === 'amc') return row.amcExpiryDate || '';
      if (sortBy === 'lastSeen') return row.tracking.lastSeenAt || '';
      if (sortBy === 'urgency') return getAmcStatus(row.amcExpiryDate ?? row.tracking?.amcExpiryDate, row.tracking?.status).daysExpired ?? -1;
      return row.vehicle.registration || '';
    };
    return [...rows].sort((a, b) => String(value(a)).localeCompare(String(value(b)), undefined, { numeric: true }));
  }, [vehicles.rows, portalFilter, physicalFilter, amcFilter, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, filter, amcFilter, portalFilter, physicalFilter, sortBy, pageSize]);

  function clearFilters() {
    setSearch('');
    setFilter('');
    setAmcFilter('');
    setPortalFilter('');
    setPhysicalFilter('');
    setViewFilter('');
    setSortBy('registration');
  }

  function chooseView(value) {
    setViewFilter(value);
    setFilter(value === 'active' ? 'active' : '');
    setAmcFilter(value === 'expired' ? 'Expired' : '');
    setPhysicalFilter(value === 'pending' ? 'Pending Inspection' : '');
  }

  async function downloadPendingInspections() {
    setExporting(true);
    setExportError('');
    try {
      const blob = await exportPendingInspections();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pending-inspections.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message || 'The inspection export could not be downloaded.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="vehicles-page">
      <header className="vehicles-page__head">
        <div>
          <h1>Vehicles</h1>
          <p>Manage and monitor all registered vehicles.</p>
        </div>
        <span>{sync?.syncedAt ? `Last synced ${formatDateTime(sync.syncedAt)}` : 'Waiting for first sync'}</span>
      </header>
      <div className="lookup-bar">
        <div className="lookup-bar__field">
          <span className="lookup-bar__label">Find a vehicle</span>
          <input
            className="input"
            aria-label="Search vehicles"
            placeholder={searchRequired ? 'Search registration, customer, phone, IMEI or SIM…' : 'Registration, customer, phone, IMEI or SIM…'}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {canRefresh ? <button type="button" className="btn btn--outline btn--small" onClick={vehicles.refreshStatus} disabled={vehicles.refreshing || !sync?.configured}>
          {vehicles.refreshing ? 'Refreshing…' : 'Refresh status'}
        </button> : null}
      </div>

      <div className="vehicle-tabs" role="tablist" aria-label="Vehicle views">
        {[
          { value: '', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired AMC' },
          { value: 'pending', label: 'Pending Inspection' },
        ].map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={viewFilter === tab.value}
            className={viewFilter === tab.value ? 'is-active' : ''}
            key={tab.value || 'all'}
            onClick={() => chooseView(tab.value)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" className="btn btn--outline btn--small vehicle-tabs__export" onClick={downloadPendingInspections} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export pending CSV'}
        </button>
      </div>
      {exportError ? <p className="app-notice app-notice--error" role="alert">{exportError}</p> : null}

      <div className="vehicle-summary" aria-label="Vehicle summary">
        <button type="button" className="vehicle-summary__card" onClick={() => { setFilter(''); setAmcFilter(''); }}>
          <span>Total vehicles</span><strong>{counts.total ?? 0}</strong>
        </button>
        <button type="button" className="vehicle-summary__card" onClick={() => { setFilter('active'); setAmcFilter(''); }}>
          <span>Tracking active</span><strong>{counts.active ?? 0}</strong>
        </button>
        <button type="button" className="vehicle-summary__card" onClick={() => setFilter('not_tracked')}>
          <span>Not tracking</span><strong>{counts.not_tracked ?? 0}</strong>
        </button>
        <button type="button" className="vehicle-summary__card" onClick={() => setAmcFilter('Expired')}>
          <span>AMC expired</span><strong>{amcCounts.total_expired ?? 0}</strong>
        </button>
        <button type="button" className="vehicle-summary__card" onClick={() => { setViewFilter('pending'); setFilter(''); setAmcFilter(''); setPhysicalFilter('Pending Inspection'); }}>
          <span>Pending inspection</span><strong>{vehicles.rows.filter((row) => row.physicalStatus === 'Pending Inspection').length}</strong>
        </button>
      </div>

      <div className="vehicle-toolbar">
        <div className="vehicle-toolbar__filters">
          <label>Tracking
            <select className="input" value={filter} onChange={(event) => { setViewFilter(''); setFilter(event.target.value); }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="not_tracked">Not tracking</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>AMC
            <select className="input" value={amcFilter} onChange={(event) => { setViewFilter(''); setAmcFilter(event.target.value); }}>
              {AMC_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Portal
            <select className="input" value={portalFilter} onChange={(event) => setPortalFilter(event.target.value)}>
              <option value="">All portals</option>
              {PORTAL_FILTERS.filter(Boolean).map((portal) => <option key={portal} value={portal}>{portal}</option>)}
            </select>
          </label>
          <label>Physical
            <select className="input" value={physicalFilter} onChange={(event) => { setViewFilter(''); setPhysicalFilter(event.target.value); }}>
              <option value="">All statuses</option>
              <option value="Verified Active">Verified Active</option>
              <option value="Pending Inspection">Pending Inspection</option>
              <option value="Removed">Removed</option>
              <option value="Needs Redo">Needs Redo</option>
              <option value="Uninstalled">Uninstalled</option>
            </select>
          </label>
          <label>Sort
            <select className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="btn btn--outline btn--small" onClick={clearFilters}>Clear all</button>
      </div>
      <SyncBanner sync={sync} />
      {vehicles.error ? <p className="app-notice app-notice--error" role="alert">Vehicles are unavailable: {vehicles.error}</p> : null}
      {vehicles.status === 'loading' ? <p className="data-state" role="status">Loading vehicles…</p> : null}

      {vehicles.status !== 'loading' && !vehicles.error && displayedRows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{searchRequired && !search ? 'Search for a vehicle to view it' : search || filter || amcFilter || portalFilter || physicalFilter ? 'No vehicle matches this filter' : 'No installed vehicles yet'}</h2>
          <p>{searchRequired && !search ? 'For security, vehicle records are hidden until you search by registration, customer, phone, IMEI or SIM.' : search || filter || amcFilter || portalFilter || physicalFilter ? 'Clear the search or choose another filter.' : 'A vehicle appears here once operations marks its installation completed.'}</p>
        </div>
      ) : null}

      {displayedRows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col">Customer</th>
                <th scope="col">Device</th>
                <th scope="col">Installation date</th>
                <th scope="col">AMC expiry</th>
                <th scope="col">AMC status</th>
                <th scope="col">Tracking status</th>
                <th scope="col">Physical status</th>
                <th scope="col">Last seen</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => {
                const tag = STATUS_TAGS[row.tracking.status] ?? STATUS_TAGS.unknown;
                const amc = getAmcStatus(row.amcExpiryDate ?? row.tracking?.amcExpiryDate, row.tracking?.status);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link className="ledger__link" to={`${base}/vehicles/${row.id}${searchRequired ? `?lookup=${encodeURIComponent(search)}` : ''}`}><span className="ledger__strong">{row.vehicle.registration || '—'}</span></Link>
                      <span className="ledger__sub">{row.vehicle.label || 'No name recorded'}{row.deviceCount > 1 ? ` · Vehicle ${row.vehicle.registration} (${row.deviceCount} Devices)` : ''}</span>
                      {row.portalSource ? <span className="portal-badge">{row.portalSource}</span> : null}
                    </td>
                    <td>
                      {canOpenCustomer && row.customer.id ? (
                        <Link className="ledger__link" to={`${customerBase}/${row.customer.id}`}>{row.customer.name || 'Customer'}</Link>
                      ) : (
                        <span className="ledger__strong">{row.customer.name || 'Customer'}</span>
                      )}
                      <span className="ledger__sub">{row.customer.phone || 'No phone'}</span>
                    </td>
                    <td>
                      {row.deviceCount > 1 ? (
                        row.devices.map((device) => (
                          <span className="device-line" key={`${device.role}-${device.imei}-${device.simNumber}`}>
                            <span className="device-line__role">{device.roleLabel}</span>
                            <span className="ledger__strong">{device.imei || 'No IMEI'}</span>
                            <span className="ledger__sub">{[device.simNumber || 'No SIM', device.network].filter(Boolean).join(' · ')}</span>
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="ledger__strong">{row.deviceImei || 'No IMEI'}</span>
                          <span className="ledger__sub">{[row.simNumber || 'No SIM', row.network].filter(Boolean).join(' · ')}</span>
                          {row.installState === 'removed' ? <span className="ledger__sub"><strong>Device removed</strong>{row.removal?.at ? ` ${new Date(row.removal.at).toLocaleDateString('en-GB')}` : ''}{row.removal?.byName ? ` by ${row.removal.byName}` : ''}</span> : null}
                          {row.installState === 'awaiting_approval' ? <span className="ledger__sub">Awaiting Operations approval</span> : null}
                        </>
                      )}
                    </td>
                    <td>
                      <span className="ledger__muted">{row.installedAt ? new Date(row.installedAt).toLocaleDateString('en-GB') : '—'}</span>
                      <span className="ledger__sub">{[row.vehicle.station, row.packageName].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>
                      <span className="ledger__muted">{row.amcExpiryDate ? new Date(row.amcExpiryDate).toLocaleDateString('en-GB') : '—'}</span>
                      {amc.daysRemaining > 0 ? <span className="ledger__sub">{amc.daysRemaining} days remaining</span> : null}
                      {amc.daysExpired > 0 ? <span className="ledger__sub">{amc.daysExpired} days overdue</span> : null}
                    </td>
                    <td><span className={`amc-badge amc-badge--${amc.color}`}>{amc.label}</span></td>
                    <td>
                      <span className="state-tag" data-state={tag.tone}>{tag.label}</span>
                      {row.tracking.gpsState ? (
                        <span className="ledger__sub">{GPS_STATE_LABELS[row.tracking.gpsState] ?? row.tracking.gpsState}</span>
                      ) : null}
                    </td>
                    <td><span className={`physical-status physical-status--${row.physicalStatus.toLowerCase().replace(/\s+/g, '-').replace('needs-redo', 'needs-redo')}`}>{row.physicalStatus}</span></td>
                    <td>
                      <span className="ledger__muted">{row.tracking.lastSeenAt ? timeAgo(row.tracking.lastSeenAt) : '—'}</span>
                      <span className="ledger__sub">{row.tracking.lastSeenAt ? formatDateTime(row.tracking.lastSeenAt) : ''}</span>
                    </td>
                    <td>
                      <button type="button" className="btn btn--outline btn--small" onClick={() => setInspectionVehicle(row)}>
                        Log inspection
                      </button>
                      {' '}
                      <button
                        type="button"
                        className="btn btn--outline btn--small"
                        onClick={() => setComplaintVehicle(row)}
                      >
                        Log complaint
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ledger-note">
        Matched to the tracking server by IMEI or unique ID. A vehicle is Inactive only when it has sent no data for more than
        {' '}{sync?.inactiveAfterDays ?? 15} days and its AMC has expired. A vehicle with two devices is shown once. “Not on tracker” means no device with that identifier was found on any configured portal.
        {sync?.syncedAt ? ` Last synced ${timeAgo(sync.syncedAt)}.` : ''}
      </p>
      {filteredRows.length > 0 ? (
        <div className="vehicle-pagination">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length}</span>
          <label>Rows
            <select className="input" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
          <button type="button" className="btn btn--outline btn--small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn--outline btn--small" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      ) : null}
      <ComplaintDrawer
        open={Boolean(complaintVehicle)}
        defaultCustomerId={complaintVehicle?.customer.id ?? ''}
        defaultCustomer={complaintVehicle?.customer ?? null}
        defaultTitle={complaintVehicle ? `Vehicle ${complaintVehicle.vehicle.registration || complaintVehicle.deviceImei} service issue` : ''}
        defaultDescription={complaintVehicle ? `Vehicle: ${complaintVehicle.vehicle.registration || 'Unknown'}\nIMEI: ${complaintVehicle.deviceImei || 'Not recorded'}` : ''}
        onClose={() => setComplaintVehicle(null)}
        onSaved={() => setComplaintVehicle(null)}
      />
      {inspectionVehicle ? (
        <VehicleInspectionModal
          vehicle={inspectionVehicle}
          onClose={() => setInspectionVehicle(null)}
          onSaved={async () => {
            setInspectionVehicle(null);
            await vehicles.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
