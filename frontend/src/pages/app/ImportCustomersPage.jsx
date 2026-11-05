import { useCallback, useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  confirmImportBatch,
  fetchImportBatch,
  fetchImportReport,
  fetchImportRows,
  fetchImports,
  previewImportBatch,
  uploadImportFile,
} from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const STEPS = ['Upload file', 'Match columns', 'Preview', 'Result'];

const OUTCOMES = {
  new_customer_vehicle: 'New customer and vehicle',
  new_customer: 'New customer',
  add_vehicle: 'Vehicle added to existing customer',
  already_imported: 'Already imported',
  duplicate_vehicle: 'Duplicate vehicle',
  duplicate_in_file: 'Repeated in this file',
  skip_existing: 'Existing customer left alone',
  no_change: 'Nothing to add',
  error: 'Error',
};
const OUTCOME_TONES = { error: 'overdue', duplicate_vehicle: 'partial', duplicate_in_file: 'partial', skip_existing: 'muted', no_change: 'muted', already_imported: 'muted' };

const STATUS_TONES = { completed: 'paid', failed: 'overdue', importing: 'partial', previewed: 'muted', uploaded: 'muted' };

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SummaryTiles({ summary }) {
  if (!summary) return null;
  const tiles = [
    ['Rows in file', summary.rows],
    ['New customers', summary.newCustomers],
    ['New vehicles', summary.newVehicles],
    ['Extra vehicles for a customer already listed', summary.addedToExisting],
    ['Duplicates skipped', summary.duplicates],
    ['Other rows skipped', Math.max(0, (summary.skipped ?? 0) - (summary.duplicates ?? 0))],
    ['Rows with errors', summary.errors, summary.errors > 0],
  ];
  return (
    <ul className="imp-summary">
      {tiles.map(([label, value, bad]) => (
        <li key={label} data-tone={bad ? 'bad' : undefined}><strong>{value ?? 0}</strong><span>{label}</span></li>
      ))}
    </ul>
  );
}

function RowsTable({ rows }) {
  if (!rows.length) return <p className="data-state">No rows to show.</p>;
  return (
    <div className="ledger-scroll">
      <table className="ledger">
        <thead><tr><th scope="col">Row</th><th scope="col">Customer</th><th scope="col">Vehicle</th><th scope="col">What happens</th><th scope="col">Notes</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.n}>
              <td>{row.n}</td>
              <td>{row.customerName || '—'}<span className="ledger__sub">{[row.phone, row.legacyId && `ID ${row.legacyId}`].filter(Boolean).join(' · ')}</span></td>
              <td>{row.registration || '—'}</td>
              <td><span className="state-tag" data-state={OUTCOME_TONES[row.outcome] ?? 'paid'}>{OUTCOMES[row.outcome] ?? row.outcome ?? '—'}</span></td>
              <td>
                {row.message ? <span className="ledger__muted">{row.message}</span> : null}
                {(row.warnings ?? []).map((warning) => <span className="ledger__sub" key={warning}>⚠ {warning}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchHistory({ refreshKey, onOpen }) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchImports({ limit: 20 }, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', rows: payload.data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', rows: [], error: error.message }); });
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Import history</h2>
          <p className="panel__meta">Every file that was uploaded, with what it did.</p>
        </div>
      </div>
      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {state.status === 'ready' && state.rows.length === 0 ? <p className="data-state">No file has been imported yet.</p> : null}
      {state.rows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger">
            <thead><tr><th scope="col">File</th><th scope="col">When</th><th scope="col">By</th><th scope="col">Result</th><th scope="col">Status</th><th scope="col" className="ledger__action-col"><span className="ledger__sr">Open</span></th></tr></thead>
            <tbody>
              {state.rows.map((batch) => (
                <tr key={batch.id}>
                  <td><span className="ledger__ref">{batch.fileName}</span><span className="ledger__sub">{batch.rowCount} rows</span></td>
                  <td>{formatDateTime(batch.completedAt ?? batch.createdAt)}</td>
                  <td>{batch.createdBy?.name ?? '—'}</td>
                  <td>
                    {batch.status === 'completed' && batch.summary
                      ? `${batch.summary.newCustomers} customers · ${batch.summary.newVehicles} vehicles${batch.summary.errors ? ` · ${batch.summary.errors} errors` : ''}`
                      : batch.error || '—'}
                  </td>
                  <td><span className="state-tag" data-state={STATUS_TONES[batch.status] ?? 'muted'}>{batch.statusLabel}</span></td>
                  <td className="ledger__action-col"><button type="button" className="btn btn--outline btn--small" onClick={() => onOpen(batch.id)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function BatchDetail({ id, onClose }) {
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchImportBatch(id).then((payload) => setBatch(payload.data.batch)).catch((error_) => setError(error_.message));
  }, [id]);

  useEffect(() => {
    fetchImportRows(id, { status: filter, limit: 100 }).then((payload) => setRows(payload.data)).catch((error_) => setError(error_.message));
  }, [id, filter]);

  async function report() {
    try { downloadBlob(await fetchImportReport(id), `${batch?.fileName ?? 'import'}-report.csv`); } catch (error_) { setError(error_.message); }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">{batch?.fileName ?? 'Import details'}</h2>
          <p className="panel__meta">{batch ? `${batch.statusLabel} · ${formatDateTime(batch.completedAt ?? batch.createdAt)}` : 'Loading…'}</p>
        </div>
        <div className="cert-preview__actions">
          <button type="button" className="btn btn--outline btn--small" onClick={report}>Download report (CSV)</button>
          <button type="button" className="btn btn--outline btn--small" onClick={onClose}>Close</button>
        </div>
      </div>
      {error ? <p className="app-notice app-notice--error" role="alert">{error}</p> : null}
      <SummaryTiles summary={batch?.summary} />
      <div className="ledger-toolbar">
        <div className="sp-chips" role="group" aria-label="Filter rows">
          {[['', 'All rows'], ['error', 'Errors'], ['skipped', 'Skipped'], ['ok', 'Imported']].map(([value, label]) => (
            <button key={value || 'all'} type="button" className={`sp-chip${filter === value ? ' is-active' : ''}`} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>
      <RowsTable rows={rows} />
    </section>
  );
}

export default function ImportCustomersPage() {
  useDocumentTitle('Customer import');
  const [step, setStep] = useState(0);
  const [upload, setUpload] = useState(null); // { batch, sample, alreadyImported, fields }
  const [mapping, setMapping] = useState({});
  const [onExisting, setOnExisting] = useState('attach');
  const [preview, setPreview] = useState(null); // { batch, rows }
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [detailId, setDetailId] = useState(null);

  const reset = useCallback(() => {
    setStep(0); setUpload(null); setMapping({}); setPreview(null); setResult(null); setAcknowledged(false); setError(null); setOnExisting('attach');
  }, []);

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const payload = await uploadImportFile(file);
      setUpload(payload.data);
      setMapping(payload.data.batch.mapping ?? {});
      setStep(1);
      setHistoryKey((key) => key + 1);
    } catch (error_) {
      setError(error_.message || 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setError(null);
    setBusy(true);
    try {
      const payload = await previewImportBatch(upload.batch.id, { mapping, options: { onExisting } });
      setPreview(payload.data);
      setAcknowledged(false);
      setStep(2);
    } catch (error_) {
      setError(error_.message || 'The preview could not be built.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const payload = await confirmImportBatch(upload.batch.id, { previewHash: preview.batch.previewHash });
      setResult(payload.data);
      setStep(3);
      setHistoryKey((key) => key + 1);
    } catch (error_) {
      setError(error_.message || 'The import could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport() {
    try { downloadBlob(await fetchImportReport(upload.batch.id), `${upload.batch.fileName}-report.csv`); } catch (error_) { setError(error_.message); }
  }

  const headers = upload?.batch.headers ?? [];
  const groups = upload ? [...new Set(upload.fields.map((field) => field.group))] : [];
  const sampleFor = (header) => (upload?.sample ?? []).map((cells) => cells[headers.indexOf(header)]).filter(Boolean).slice(0, 2).join(' · ');
  const errorCount = preview?.batch.summary?.errors ?? 0;
  const importable = (preview?.batch.summary?.newCustomers ?? 0) + (preview?.batch.summary?.newVehicles ?? 0) > 0;

  return (
    <div className="invoices-page">
      <ol className="imp-steps" aria-label="Import steps">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>{index + 1}. {label}</li>
        ))}
      </ol>

      {error ? <p className="form-alert" role="alert">{error}</p> : null}

      {step === 0 ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Upload a customer file</h2>
              <p className="panel__meta">Excel (.xlsx) or CSV, up to 5 MB. One row per vehicle: a customer with three vehicles can use three rows. Nothing is saved until you confirm.</p>
            </div>
          </div>
          <div className="imp-drop">
            <p>Choose the file to import. The first row must hold the column names.</p>
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} disabled={busy} aria-label="Choose a customer file" />
            {busy ? <p role="status">Reading the file…</p> : null}
          </div>
          <p className="field__hint" style={{ padding: '0 18px 16px' }}>
            Imported customers are treated as existing customers: they are active straight away and do not go through new-customer onboarding or the security briefing.
          </p>
        </section>
      ) : null}

      {step === 1 && upload ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Match the columns</h2>
              <p className="panel__meta">{upload.batch.fileName} · {upload.batch.rowCount} rows. Columns were matched automatically; correct any that are wrong. Name and phone are required.</p>
            </div>
          </div>
          {upload.alreadyImported ? (
            <p className="app-notice app-notice--error" role="alert">
              This exact file was already imported on {formatDateTime(upload.alreadyImported.at)}. Importing it again will not create duplicates, because existing customers and vehicles are recognised.
            </p>
          ) : null}
          <div className="ledger-scroll">
            <table className="imp-map">
              <thead><tr><th scope="col">Field in the Hub</th><th scope="col">Column in your file</th><th scope="col">Example from the file</th></tr></thead>
              <tbody>
                {groups.map((group) => (
                  <GroupRows key={group} group={group} fields={upload.fields.filter((field) => field.group === group)} headers={headers} mapping={mapping} setMapping={setMapping} sampleFor={sampleFor} />
                ))}
              </tbody>
            </table>
          </div>
          <fieldset className="imp-confirm" style={{ border: 0, display: 'grid', gap: 6, paddingTop: 14 }}>
            <legend className="field__label">When a customer already exists</legend>
            <label><input type="radio" name="onExisting" checked={onExisting === 'attach'} onChange={() => setOnExisting('attach')} /> Add the new vehicles to them (their details are never changed)</label>
            <label><input type="radio" name="onExisting" checked={onExisting === 'skip'} onChange={() => setOnExisting('skip')} /> Leave them alone completely</label>
          </fieldset>
          <p className="field__hint" style={{ padding: '4px 18px 0' }}>Columns you do not match are kept on the customer as legacy information, not thrown away.</p>
          <div className="imp-actions">
            <button type="button" className="btn btn--outline" onClick={reset} disabled={busy}>Start over</button>
            <button type="button" className="btn btn--primary" onClick={runPreview} disabled={busy || !mapping.name || !mapping.phone}>{busy ? 'Checking…' : 'Preview import'}</button>
          </div>
        </section>
      ) : null}

      {step === 2 && preview ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Preview</h2>
              <p className="panel__meta">This is what will happen. Nothing has been saved yet.</p>
            </div>
          </div>
          <SummaryTiles summary={preview.batch.summary} />
          <RowsTable rows={preview.rows} />
          {preview.batch.rowCount > preview.rows.length ? <p className="field__hint" style={{ padding: '8px 18px' }}>Showing the first rows that need attention and the first rows that will import. The full list is in the report after the import.</p> : null}
          {errorCount > 0 ? (
            <label className="imp-confirm">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              <span>I understand the {errorCount} row{errorCount === 1 ? '' : 's'} with errors will not be imported.</span>
            </label>
          ) : null}
          {!importable ? <p className="data-state">Nothing in this file would be added, so there is nothing to import.</p> : null}
          <div className="imp-actions">
            <button type="button" className="btn btn--outline" onClick={() => setStep(1)} disabled={busy}>Back to columns</button>
            <button type="button" className="btn btn--primary" onClick={confirm} disabled={busy || !importable || (errorCount > 0 && !acknowledged)}>
              {busy ? 'Importing…' : `Import ${preview.batch.summary.newCustomers} customers and ${preview.batch.summary.newVehicles} vehicles`}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 && result ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">{result.repeated ? 'Already imported' : 'Import finished'}</h2>
              <p className="panel__meta">{result.repeated ? 'This import had already run, so nothing was added a second time.' : `${result.batch.fileName} was imported.`}</p>
            </div>
          </div>
          <SummaryTiles summary={result.batch.summary} />
          <div className="imp-actions">
            <button type="button" className="btn btn--outline" onClick={downloadReport}>Download report (CSV)</button>
            <button type="button" className="btn btn--primary" onClick={reset}>Import another file</button>
          </div>
        </section>
      ) : null}

      {detailId ? <BatchDetail id={detailId} onClose={() => setDetailId(null)} /> : null}
      <BatchHistory refreshKey={historyKey} onOpen={setDetailId} />
    </div>
  );
}

function GroupRows({ group, fields, headers, mapping, setMapping, sampleFor }) {
  return (
    <>
      <tr className="imp-group"><td colSpan={3}>{group}</td></tr>
      {fields.map((field) => (
        <tr key={field.key}>
          <td>{field.label}{field.required ? <small>Required</small> : null}</td>
          <td>
            <select
              className="input"
              aria-label={`Column for ${field.label}`}
              value={mapping[field.key] ?? ''}
              onChange={(event) => setMapping((current) => {
                const next = { ...current };
                if (event.target.value) next[field.key] = event.target.value; else delete next[field.key];
                return next;
              })}
            >
              <option value="">— Not in my file —</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
          </td>
          <td><span className="ledger__muted">{mapping[field.key] ? sampleFor(mapping[field.key]) || '—' : ''}</span></td>
        </tr>
      ))}
    </>
  );
}
