import { useCallback, useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  assignMicrophone,
  createMicrophone,
  fetchMicrophoneTasks,
  fetchMicrophones,
  releaseMicrophone,
} from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function OperationsMicrophonesPage() {
  useDocumentTitle('Microphones');
  const [inventory, setInventory] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const [tasks, setTasks] = useState({ status: 'loading', rows: [], error: null });
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [picks, setPicks] = useState({});
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      const [inventoryPayload, taskPayload] = await Promise.all([
        fetchMicrophones({ signal }),
        fetchMicrophoneTasks({ signal }),
      ]);
      setInventory({ status: 'ready', rows: inventoryPayload.data ?? [], meta: inventoryPayload.meta ?? null, error: null });
      setTasks({ status: 'ready', rows: taskPayload.data ?? [], error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setInventory((previous) => ({ ...previous, status: 'error', error: error.message }));
      setTasks((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const available = inventory.rows.filter((row) => row.status === 'available');

  async function addNumber(event) {
    event.preventDefault();
    setBusy('add');
    setFeedback(null);
    try {
      await createMicrophone({ number, label });
      setNumber('');
      setLabel('');
      await load();
      setFeedback({ tone: 'ok', text: 'Number added to the inventory.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function assign(row) {
    const selected = picks[row.id];
    if (!selected) {
      setFeedback({ tone: 'error', text: 'Choose an available number first.' });
      return;
    }
    setBusy(`assign-${row.id}`);
    setFeedback(null);
    try {
      await assignMicrophone(selected, { jobId: row.id });
      setPicks((previous) => ({ ...previous, [row.id]: '' }));
      await load();
      setFeedback({ tone: 'ok', text: `Number assigned to ${row.customerName}.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function release(id) {
    setBusy(`release-${id}`);
    setFeedback(null);
    try {
      await releaseMicrophone(id);
      await load();
      setFeedback({ tone: 'ok', text: 'Number returned to the pool.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="field-page">
      <div className="field-strip">
        <div><span>Available</span><strong>{inventory.meta?.available ?? 0}</strong></div>
        <div><span>Assigned</span><strong>{inventory.meta?.assigned ?? 0}</strong></div>
        <div><span>Vehicles waiting</span><strong>{tasks.rows.length}</strong></div>
      </div>

      {feedback ? (
        <div className={`field-message field-message--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      ) : null}

      {inventory.error ? <div className="field-alert" role="alert"><p>{inventory.error}</p></div> : null}

      <section className="field-block">
        <header className="field-block__head">
          <h2>Waiting for a number</h2>
          <p>Standard and Premium installations generate this task as soon as operations approves them.</p>
        </header>

        {tasks.status === 'loading' ? <p className="data-state">Loading pending assignments…</p> : null}

        {!tasks.status || tasks.status === 'ready' ? (
          tasks.rows.length ? (
            <ul className="field-tasks">
              {tasks.rows.map((row) => (
                <li key={row.id}>
                  <div>
                    <p className="field-tasks__name">{row.customerName}</p>
                    <p className="field-tasks__meta">
                      {row.vehicle.registration || 'No registration'} · {row.packageName} · {row.vehicle.station || 'no station'}
                    </p>
                  </div>
                  <div className="field-tasks__action">
                    <select
                      aria-label={`Microphone number for ${row.customerName}`}
                      value={picks[row.id] ?? ''}
                      onChange={(event) => setPicks((previous) => ({ ...previous, [row.id]: event.target.value }))}
                    >
                      <option value="">Choose a number…</option>
                      {available.map((option) => <option key={option.id} value={option.id}>{option.number}</option>)}
                    </select>
                    <button type="button" className="btn btn--outline btn--small" disabled={busy === `assign-${row.id}`} onClick={() => assign(row)}>
                      {busy === `assign-${row.id}` ? 'Assigning…' : 'Assign'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="field-empty field-empty--tight">
              <p className="field-empty__title">No vehicle is waiting for a microphone number</p>
              <p>Assignments appear here after a Standard or Premium installation is approved.</p>
            </div>
          )
        ) : null}
      </section>

      <section className="field-block">
        <header className="field-block__head">
          <h2>Number inventory</h2>
          <p>A number can only be active on one vehicle. Releasing it returns it to the pool without erasing its history.</p>
        </header>

        <form className="field-form" onSubmit={addNumber}>
          <label className="field-field">
            <span>Microphone number</span>
            <input type="text" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="e.g. 0300 000 0000" required />
          </label>
          <label className="field-field">
            <span>Label</span>
            <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional note" />
          </label>
          <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'add'}>
            {busy === 'add' ? 'Adding…' : 'Add number'}
          </button>
        </form>

        {inventory.rows.length ? (
          <div className="field-table-wrap">
            <table className="field-table">
              <thead><tr><th>Number</th><th>Status</th><th>Customer</th><th>Assigned</th><th /></tr></thead>
              <tbody>
                {inventory.rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.number}</strong>{row.label ? <span className="field-table__muted"> · {row.label}</span> : null}</td>
                    <td>
                      <span className={`field-chip field-chip--${row.status === 'available' ? 'ok' : row.status === 'assigned' ? 'warn' : 'plain'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.customer?.name ?? '—'}</td>
                    <td className="field-table__muted">{row.assignedAt ? formatDateTime(row.assignedAt) : '—'}</td>
                    <td>
                      {row.status === 'assigned' ? (
                        <button type="button" className="field-link-button" disabled={busy === `release-${row.id}`} onClick={() => release(row.id)}>
                          {busy === `release-${row.id}` ? 'Releasing…' : 'Release'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="field-empty field-empty--tight">
            <p className="field-empty__title">The inventory is empty</p>
            <p>Add the microphone numbers the business owns. Until a number exists, no Standard or Premium vehicle can be completed.</p>
          </div>
        )}
      </section>
    </div>
  );
}
