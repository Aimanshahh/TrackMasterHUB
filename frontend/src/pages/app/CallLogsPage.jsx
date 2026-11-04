import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCalls } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const FILTERS = [
  { value: '', label: 'All calls' },
  { value: 'answered', label: 'Answered' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
];
const TONES = { answered: 'paid', no_answer: 'overdue', busy: 'partial', other: 'muted' };

/** Robocall results as received from the provider. Shared by admin and operations. */
export default function CallLogsPage() {
  useDocumentTitle('Call logs');
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 320);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (signal) => {
    try {
      const payload = await fetchCalls({ status: filter, q: query, limit: 100 }, { signal });
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [filter, query]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const customerLink = (id) => (user?.role === 'admin' ? `/admin/customers/${id}` : null);
  const { meta } = state;

  return (
    <div className="invoices-page">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Robocall results</h2>
            <p className="panel__meta">
              {meta ? `${meta.total} ${meta.total === 1 ? 'call' : 'calls'} · ${meta.answered} answered` : 'Calls received from the provider'}
            </p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={() => load()}>Refresh</button>
        </div>

        <div className="ledger-toolbar">
          <div className="ledger-toolbar__search">
            <input className="input" aria-label="Search calls" placeholder="Phone number, city, alert or call ID…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="sp-chips" role="group" aria-label="Filter calls">
            {FILTERS.map((option) => (
              <button key={option.value || 'all'} type="button" className={`sp-chip${filter === option.value ? ' is-active' : ''}`} onClick={() => setFilter(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>

        {state.error ? <p className="app-notice app-notice--error" role="alert">Calls could not be loaded: {state.error}</p> : null}
        {state.status === 'loading' ? <p className="data-state" role="status">Loading calls…</p> : null}
        {state.status === 'ready' && state.rows.length === 0 ? (
          <div className="app-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>{filter || query ? 'No call matches this filter' : 'No call has been received yet'}</h2>
            <p>{filter || query ? 'Clear the filter to see every call.' : 'Calls appear here as soon as the provider sends its first result to the Hub.'}</p>
          </div>
        ) : null}

        {state.rows.length > 0 ? (
          <div className="ledger-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Time</th><th scope="col">Result</th><th scope="col">Called</th><th scope="col">Customer</th>
                  <th scope="col">Duration</th><th scope="col">Keypress</th><th scope="col">Alert</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((call) => (
                  <tr key={call.id}>
                    <td>{formatDateTime(call.calledAt)}</td>
                    <td><span className="state-tag" data-state={TONES[call.status]}>{call.statusLabel}</span></td>
                    <td><span className="ledger__ref">{call.calledNumber}</span></td>
                    <td>
                      {call.customer ? (customerLink(call.customer.id) ? <Link to={customerLink(call.customer.id)}>{call.customer.name}</Link> : call.customer.name) : <span className="ledger__muted">Not matched</span>}
                    </td>
                    <td>{call.durationSeconds}s</td>
                    <td>{call.dtmf || '—'}</td>
                    <td>{call.alertType || '—'}{call.alertId ? <span className="ledger__sub">#{call.alertId}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
