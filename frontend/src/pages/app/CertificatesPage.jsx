import { useCallback, useEffect, useState } from 'react';

import CertificateActionDrawer from '../../components/certificates/CertificateActionDrawer.jsx';
import CertificatePreview from '../../components/certificates/CertificatePreview.jsx';
import CertificateTable from '../../components/certificates/CertificateTable.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCertificate, fetchCertificateCustomers, fetchCertificates, issueCertificatesRecord } from '../../lib/api.js';
import { formatDay, toInputDate } from '../../lib/dates.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'superseded', label: 'Replaced' },
  { value: 'cancelled', label: 'Cancelled' },
];

function useDebounced(value, ms = 320) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** One vehicle row in the issue form: a checkbox plus the details the certificate prints. */
function VehicleRow({ vehicle, entry, onChange, onView }) {
  const blocked = vehicle.certificate?.status === 'active';
  const update = (key) => (event) => onChange({ ...entry, [key]: event.target.value });

  return (
    <li className={`cert-vehicle${entry.selected ? ' is-selected' : ''}`}>
      <label className="cert-vehicle__head">
        <input type="checkbox" disabled={blocked} checked={entry.selected && !blocked} onChange={(event) => onChange({ ...entry, selected: event.target.checked })} />
        <span>
          <strong>{vehicle.registration}</strong>
          <small>{vehicle.makeModel || 'Make / model not recorded'} · installed {formatDay(vehicle.installedAt)}</small>
        </span>
      </label>

      {blocked ? (
        <p className="cert-vehicle__note">
          Already has active certificate {vehicle.certificate.number}.{' '}
          <button type="button" className="link-button" onClick={() => onView(vehicle.certificate)}>View it</button>. Use Reissue in the register to replace it.
        </p>
      ) : null}

      {entry.selected && !blocked ? (
        <div className="field-grid cert-vehicle__fields">
          <label className="field"><span className="field__label">Make / model</span><input className="input" maxLength={120} value={entry.makeModel} onChange={update('makeModel')} /></label>
          <label className="field"><span className="field__label">Colour</span><input className="input" maxLength={40} value={entry.colour} onChange={update('colour')} /></label>
          <label className="field"><span className="field__label">Engine no.</span><input className="input" maxLength={60} value={entry.engineNo} onChange={update('engineNo')} /></label>
          <label className="field"><span className="field__label">Chassis no.</span><input className="input" maxLength={60} value={entry.chassisNo} onChange={update('chassisNo')} /></label>
          <label className="field"><span className="field__label">Installed on</span><input className="input" type="date" value={entry.installedAt} onChange={update('installedAt')} /></label>
          <label className="field"><span className="field__label">Valid until <i>blank = 12 months</i></span><input className="input" type="date" value={entry.expiresAt} onChange={update('expiresAt')} /></label>
        </div>
      ) : null}
    </li>
  );
}

function IssueTab({ onIssued, onView }) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const [list, setList] = useState({ status: 'idle', rows: [], error: null });
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState({});
  const [customerForm, setCustomerForm] = useState({ address: '', cnic: '', showCnic: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setList({ status: 'idle', rows: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    setList((current) => ({ ...current, status: 'loading', error: null }));
    fetchCertificateCustomers({ q: query, limit: 12 }, { signal: controller.signal })
      .then((payload) => setList({ status: 'ready', rows: payload.data, error: null }))
      .catch((error_) => { if (error_.name !== 'AbortError') setList({ status: 'error', rows: [], error: error_.message }); });
    return () => controller.abort();
  }, [query]);

  function choose(customer) {
    setSelected(customer);
    setError(null);
    setCustomerForm({ address: customer.address, cnic: customer.cnic, showCnic: true });
    setEntries(Object.fromEntries(customer.vehicles.map((vehicle) => [vehicle.jobId, {
      selected: false,
      makeModel: vehicle.makeModel,
      colour: vehicle.colour,
      engineNo: vehicle.engineNo,
      chassisNo: vehicle.chassisNo,
      installedAt: toInputDate(vehicle.installedAt),
      expiresAt: '',
    }])));
  }

  const chosen = selected ? selected.vehicles.filter((vehicle) => entries[vehicle.jobId]?.selected && vehicle.certificate?.status !== 'active') : [];

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (chosen.length === 0) return setError('Tick at least one vehicle.');
    setSaving(true);
    try {
      const payload = await issueCertificatesRecord({
        customerId: selected.id,
        vehicles: chosen.map((vehicle) => ({ jobId: vehicle.jobId, ...entries[vehicle.jobId], selected: undefined })),
        customer: { address: customerForm.address, cnic: customerForm.cnic },
        showCnic: customerForm.showCnic,
      });
      setSelected(null);
      await onIssued(payload.data.certificates);
    } catch (error_) {
      setError(error_.message || 'The certificates could not be issued.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cert-issue">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Find the customer</h2>
            <p className="panel__meta">Customers with a completed installation. Search by name, phone or registration.</p>
          </div>
        </div>
        <div className="ledger-toolbar">
          <div className="ledger-toolbar__search">
            <input className="input" aria-label="Search customers" placeholder="Name, phone or registration number…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        {list.error ? <p className="app-notice app-notice--error" role="alert">{list.error}</p> : null}
        {list.status === 'idle' ? <p className="cert-search-hint">Enter at least 2 characters to search customers by name, phone, or registration.</p> : null}
        {list.status === 'loading' && list.rows.length === 0 ? <p className="data-state" role="status">Searching…</p> : null}
        {list.status === 'ready' && list.rows.length === 0 ? <p className="data-state">No customer with a completed installation matches this search.</p> : null}
        <div className="cert-customer-list" role="list">
          {[...list.rows].sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
            <button type="button" role="listitem" className={`cert-customer${selected?.id === customer.id ? ' is-active' : ''}`} onClick={() => choose(customer)}>
              <span className="cert-customer__name">{customer.name}</span>
              <span className="cert-customer__phone">{customer.phone || 'No phone'}</span>
              <span className="cert-customer__vehicles">{customer.vehicles.length} {customer.vehicles.length === 1 ? 'vehicle' : 'vehicles'}</span>
              <span className="cert-customer__action">Select</span>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <form className="panel cert-selected-panel" onSubmit={submit}>
          <div className="panel__head">
            <div>
              <p className="cert-selected__eyebrow">Selected customer</p>
              <h2 className="panel__title">{selected.name}</h2>
              <p className="panel__meta">Tick the vehicles. Anything you fill in here is also saved on the vehicle and customer record.</p>
            </div>
            <div className="cert-selected__meta">
              <strong>{selected.vehicles.length}</strong>
              <span>{selected.vehicles.length === 1 ? 'vehicle' : 'vehicles'} found</span>
            </div>
          </div>

          <div className="cert-customer-fields">
            <label className="field"><span className="field__label">Customer address <i>printed on the certificate</i></span><input className="input" maxLength={400} value={customerForm.address} onChange={(event) => setCustomerForm((c) => ({ ...c, address: event.target.value }))} /></label>
            <div className="cert-cnic-row">
              <label className="field"><span className="field__label">CNIC</span><input className="input" maxLength={20} value={customerForm.cnic} onChange={(event) => setCustomerForm((c) => ({ ...c, cnic: event.target.value }))} /></label>
              <label className="cert-check"><input type="checkbox" checked={customerForm.showCnic} onChange={(event) => setCustomerForm((c) => ({ ...c, showCnic: event.target.checked }))} /><span>Print CNIC on certificate</span></label>
            </div>
          </div>

          <ul className="cert-vehicles">
            {selected.vehicles.map((vehicle) => (
              <VehicleRow
                key={vehicle.jobId}
                vehicle={vehicle}
                entry={entries[vehicle.jobId]}
                onChange={(next) => setEntries((current) => ({ ...current, [vehicle.jobId]: next }))}
                onView={(certificate) => onView(certificate.id)}
              />
            ))}
          </ul>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <div className="cert-issue__foot">
            <span className="cert-issue__count">{chosen.length} selected for issue</span>
            <button type="submit" className="btn btn--primary" disabled={saving || chosen.length === 0}>
              {saving ? 'Issuing…' : `Generate ${chosen.length || ''} certificate${chosen.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function RegisterTab({ refreshKey, onPreview, onReissue, onCancel }) {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });

  const load = useCallback((signal) => fetchCertificates({ status: filter, q: query, limit: 100 }, { signal })
    .then((payload) => setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null }))
    .catch((error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error: error.message })); }), [filter, query]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Certificate register</h2>
          <p className="panel__meta">{state.meta ? `${state.meta.total} ${state.meta.total === 1 ? 'certificate' : 'certificates'}` : 'Every certificate ever issued'}</p>
        </div>
      </div>
      <div className="ledger-toolbar">
        <div className="ledger-toolbar__search">
          <input className="input" aria-label="Search certificates" placeholder="Certificate number, registration or customer…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="sp-chips" role="group" aria-label="Filter certificates">
          {FILTERS.map((option) => (
            <button key={option.value || 'all'} type="button" className={`sp-chip${filter === option.value ? ' is-active' : ''}`} onClick={() => setFilter(option.value)}>{option.label}</button>
          ))}
        </div>
      </div>
      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {state.status === 'loading' ? <p className="data-state" role="status">Loading certificates…</p> : null}
      {state.status === 'ready' ? (
        <CertificateTable
          certificates={state.rows}
          onPreview={onPreview}
          onReissue={onReissue}
          onCancel={onCancel}
          emptyMessage={filter || query ? 'No certificate matches this filter.' : 'No certificate has been issued yet. Use “Issue certificates” to create the first one.'}
        />
      ) : null}
    </section>
  );
}

export default function CertificatesPage() {
  useDocumentTitle('Certificates');
  const [tab, setTab] = useState('issue');
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [action, setAction] = useState(null); // { certificate, mode }

  const previewById = useCallback(async (id) => {
    try {
      setPreview((await fetchCertificate(id)).data.certificate);
    } catch (error) {
      setNotice(error.message || 'The certificate could not be opened.');
    }
  }, []);

  async function issued(certificates) {
    setRefreshKey((key) => key + 1);
    setNotice(`${certificates.length === 1 ? 'Certificate' : 'Certificates'} ${certificates.map((c) => c.number).join(', ')} issued.`);
    setPreview(certificates[0]);
  }

  async function actionDone(certificate, mode) {
    setRefreshKey((key) => key + 1);
    setNotice(mode === 'reissue' ? `Reissued as ${certificate.number}. The previous certificate is marked Replaced.` : `Certificate ${certificate.number} cancelled.`);
    if (mode === 'reissue') setPreview(certificate);
  }

  return (
    <div className="invoices-page">
      <div className="sp-chips" role="tablist" aria-label="Certificate desk">
        <button type="button" role="tab" aria-selected={tab === 'issue'} className={`sp-chip${tab === 'issue' ? ' is-active' : ''}`} onClick={() => setTab('issue')}>Issue certificates</button>
        <button type="button" role="tab" aria-selected={tab === 'register'} className={`sp-chip${tab === 'register' ? ' is-active' : ''}`} onClick={() => setTab('register')}>Register and history</button>
      </div>

      {notice ? <p className="form-notice" role="status">{notice}</p> : null}

      {tab === 'issue' ? <IssueTab onIssued={issued} onView={previewById} /> : null}
      {tab === 'register' ? <RegisterTab refreshKey={refreshKey} onPreview={setPreview} onReissue={(certificate) => setAction({ certificate, mode: 'reissue' })} onCancel={(certificate) => setAction({ certificate, mode: 'cancel' })} /> : null}

      {preview ? <CertificatePreview certificate={preview} onClose={() => setPreview(null)} /> : null}
      {action ? <CertificateActionDrawer certificate={action.certificate} mode={action.mode} onClose={() => setAction(null)} onDone={actionDone} /> : null}
    </div>
  );
}
