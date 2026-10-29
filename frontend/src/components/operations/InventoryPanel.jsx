import { useState } from 'react';

import { STOCK_STATUS_OPTIONS } from '../../app/operations.js';
import { useDevices, useKnownStations, useSims, useTechnicians } from '../../hooks/useOperations.js';
import { createDeviceRecord, createSimRecord, updateDeviceRecord, updateSimRecord } from '../../lib/api.js';
import { StockStatus } from './OpsStatus.jsx';
import StationField from './StationField.jsx';

function AddStockDrawer({ kind, stations, onClose, onCreated }) {
  const isDevice = kind === 'devices';
  const [form, setForm] = useState(isDevice
    ? { imei: '', model: '', station: '', notes: '' }
    : { number: '', operator: '', iccid: '', station: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isDevice) await createDeviceRecord(form);
      else await createSimRecord(form);
      onCreated();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'This stock item could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close stock form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-stock-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Inventory</p>
            <h2 className="drawer__title" id="add-stock-title">{isDevice ? 'Add device stock' : 'Add SIM stock'}</h2>
            <p className="drawer__subtitle">Every item is tracked individually so it can be assigned once, then fitted, returned or transferred with a record.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="drawer__section-label">{isDevice ? 'Device' : 'SIM'}</div>
          {isDevice ? (
            <div className="field-grid">
              <label className="field field--full">
                <span className="field__label">IMEI <i>Required</i></span>
                <input className="input" value={form.imei} onChange={update('imei')} inputMode="numeric" minLength={14} maxLength={17} required placeholder="15-digit device IMEI" />
              </label>
              <label className="field field--full">
                <span className="field__label">Device model</span>
                <input className="input" value={form.model} onChange={update('model')} maxLength={120} placeholder="e.g. tracker model name" />
              </label>
            </div>
          ) : (
            <div className="field-grid">
              <label className="field field--full">
                <span className="field__label">SIM number <i>Required</i></span>
                <input className="input" value={form.number} onChange={update('number')} minLength={6} maxLength={40} required placeholder="Number printed on the SIM" />
              </label>
              <label className="field">
                <span className="field__label">Operator</span>
                <input className="input" value={form.operator} onChange={update('operator')} maxLength={60} placeholder="Network operator" />
              </label>
              <label className="field">
                <span className="field__label">ICCID</span>
                <input className="input" value={form.iccid} onChange={update('iccid')} maxLength={40} placeholder="Optional" />
              </label>
            </div>
          )}

          <div className="drawer__section-label">Storage</div>
          <StationField value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} stations={stations} required hint="The station holding this stock until it is handed to a technician." />
          <label className="field">
            <span className="field__label">Notes</span>
            <textarea className="input input--area" rows={2} maxLength={1000} value={form.notes} onChange={update('notes')} placeholder="Condition, supplier reference or anything useful." />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Adding…' : 'Add to stock'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AssignStockDrawer({ kind, item, onClose, onDone }) {
  const isDevice = kind === 'devices';
  const technicians = useTechnicians({ activeOnly: true });
  const [technicianId, setTechnicianId] = useState(item.technician?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(nextTechnicianId) {
    setSaving(true);
    setError(null);
    try {
      if (isDevice) await updateDeviceRecord(item.id, { technicianId: nextTechnicianId || null });
      else await updateSimRecord(item.id, { technicianId: nextTechnicianId || null });
      onDone();
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'This stock item could not be assigned.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close assignment form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="assign-stock-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{isDevice ? 'Device' : 'SIM'} · {isDevice ? item.imei : item.number}</p>
            <h2 className="drawer__title" id="assign-stock-title">{item.technician ? 'Reassign stock' : 'Hand stock to a technician'}</h2>
            <p className="drawer__subtitle">{item.technician ? `Currently held by ${item.technician.name}.` : 'Select the technician who will carry this item.'}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={(event) => { event.preventDefault(); save(technicianId); }}>
          <div className="drawer__section-label">Technician</div>
          <label className="field">
            <span className="field__label">Assigned to</span>
            <select className="input" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
              <option value="">Station stock (not assigned)</option>
              {technicians.rows.map((technician) => (
                <option key={technician.id} value={technician.id}>{technician.name}{technician.station ? ` · ${technician.station}` : ''}</option>
              ))}
            </select>
            {technicians.status === 'ready' && technicians.rows.length === 0 ? <span className="field__hint">No active technicians yet. Add the field team first.</span> : null}
          </label>
          <p className="field__hint">The technician’s stock count updates immediately. When they are down to fewer than three devices, the desk is alerted.</p>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            {item.technician ? <button type="button" className="btn btn--outline" onClick={() => save('')} disabled={saving}>Return to station</button> : null}
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Assign stock'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function InventoryPanel() {
  const [tab, setTab] = useState('devices');
  const [status, setStatus] = useState('in_stock');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const devices = useDevices({ status, search, limit: 50 });
  const sims = useSims({ status, search, limit: 50 });
  const stations = useKnownStations([devices.rows, sims.rows]);
  const active = tab === 'devices' ? devices : sims;

  async function setServiceStatus(kind, id, nextStatus) {
    if (kind === 'devices') await updateDeviceRecord(id, { status: nextStatus });
    else await updateSimRecord(id, { status: nextStatus });
    active.refresh();
  }

  const emptyLabel = status === 'out_of_service'
    ? 'out of service'
    : status === 'assigned'
      ? 'technician-held'
      : tab === 'devices' ? 'device' : 'SIM';

  return (
    <div className="panel ops-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Stock register</h2>
          <p className="panel__meta">{active.meta?.total ?? active.rows.length} {tab === 'devices' ? 'devices' : 'SIMs'} in this view</p>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={() => setAddOpen(true)}>Add {tab === 'devices' ? 'device' : 'SIM'} <span aria-hidden="true">+</span></button>
          <button type="button" className="btn btn--outline btn--small" onClick={active.refresh}>Refresh</button>
        </div>
      </div>

      <div className="ops-tabs" role="tablist" aria-label="Stock type">
        <button type="button" role="tab" aria-selected={tab === 'devices'} className={tab === 'devices' ? 'is-active' : ''} onClick={() => setTab('devices')}>Devices</button>
        <button type="button" role="tab" aria-selected={tab === 'sims'} className={tab === 'sims' ? 'is-active' : ''} onClick={() => setTab('sims')}>SIM cards</button>
      </div>

      <div className="ops-toolbar">
        <input aria-label="Search stock" placeholder={tab === 'devices' ? 'Search IMEI, model or station…' : 'Search SIM number, ICCID or operator…'} value={search} onChange={(event) => setSearch(event.target.value)} />
        <label><span>Status</span>
          <select aria-label="Filter stock by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All stock</option>
            {STOCK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {active.error ? <p className="app-notice app-notice--error" role="alert">Stock could not be loaded: {active.error}</p> : null}
      {active.status === 'loading' ? <p className="data-state" role="status">Loading stock…</p> : null}

      {active.status !== 'loading' && !active.error && active.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>No {emptyLabel} stock here</h2>
          <p>Stock recorded by operations will appear here. Assigning an item to a technician or a job moves it out of station stock automatically.</p>
        </div>
      ) : null}

      {active.rows.length > 0 ? (
        <div className="ops-table__scroll">
          {tab === 'devices' ? (
            <div className="ops-table ops-table--stock">
              <div className="ops-table__head"><span>IMEI</span><span>Model</span><span>Station</span><span>Status</span><span>With</span><span aria-hidden="true" /></div>
              {devices.rows.map((device) => (
                <div className="ops-table__row" key={device.id}>
                  <span className="ops-mono">{device.imei}</span>
                  <span>{device.model || <span className="ops-cell-muted">—</span>}</span>
                  <span className="ops-cell-muted">{device.station || '—'}</span>
                  <span><StockStatus status={device.status} /></span>
                  <span className="ops-cell-muted">{device.job ? 'Fitted to a job' : device.technician?.name || 'Station stock'}</span>
                  <span className="ops-row-action">
                    {device.job ? null : (
                      <>
                        <button type="button" className="ops-link" onClick={() => setAssigning({ kind: 'devices', item: device })}>
                          {device.technician ? 'Reassign' : 'Assign'}
                        </button>
                        {device.status === 'in_stock' ? <button type="button" className="ops-link" onClick={() => setServiceStatus('devices', device.id, 'out_of_service')}>Out of service</button> : null}
                        {device.status === 'out_of_service' ? <button type="button" className="ops-link" onClick={() => setServiceStatus('devices', device.id, 'in_stock')}>Return to service</button> : null}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ops-table ops-table--stock">
              <div className="ops-table__head"><span>SIM number</span><span>Operator</span><span>Station</span><span>Status</span><span>With</span><span aria-hidden="true" /></div>
              {sims.rows.map((sim) => (
                <div className="ops-table__row" key={sim.id}>
                  <span className="ops-mono">{sim.number}</span>
                  <span>{sim.operator || <span className="ops-cell-muted">—</span>}</span>
                  <span className="ops-cell-muted">{sim.station || '—'}</span>
                  <span><StockStatus status={sim.status} /></span>
                  <span className="ops-cell-muted">{sim.job ? 'Fitted to a job' : sim.technician?.name || 'Station stock'}</span>
                  <span className="ops-row-action">
                    {sim.job ? null : (
                      <>
                        <button type="button" className="ops-link" onClick={() => setAssigning({ kind: 'sims', item: sim })}>
                          {sim.technician ? 'Reassign' : 'Assign'}
                        </button>
                        {sim.status === 'in_stock' ? <button type="button" className="ops-link" onClick={() => setServiceStatus('sims', sim.id, 'out_of_service')}>Out of service</button> : null}
                        {sim.status === 'out_of_service' ? <button type="button" className="ops-link" onClick={() => setServiceStatus('sims', sim.id, 'in_stock')}>Return to service</button> : null}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {addOpen ? <AddStockDrawer kind={tab} stations={stations} onClose={() => setAddOpen(false)} onCreated={active.refresh} /> : null}

      {assigning ? (
        <AssignStockDrawer
          kind={assigning.kind}
          item={assigning.item}
          onClose={() => setAssigning(null)}
          onDone={() => {
            if (assigning.kind === 'devices') devices.refresh();
            else sims.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
