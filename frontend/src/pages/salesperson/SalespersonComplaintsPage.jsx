import { useCallback, useEffect, useState } from 'react';

import { COMPLAINT_STATUS_OPTIONS, formatDayTime } from '../../app/operations.js';
import { StatusPill } from '../../components/operations/OpsStatus.jsx';
import ComplaintDrawer from '../../components/salesperson/ComplaintDrawer.jsx';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchComplaints } from '../../lib/api.js';

export default function SalespersonComplaintsPage() {
  useDocumentTitle('Complaints');
  const customers = useCustomers({ limit: 100 });
  const [status, setStatus] = useState('');
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading', error: null }));
    try {
      const payload = await fetchComplaints({ status, limit: 50 });
      setState({ status: 'ready', rows: payload.data, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sp-tickets">
      <section className="sp-toolbar sp-toolbar--tight">
        <div className="sp-chips" role="group" aria-label="Filter tickets by status">
          <button type="button" className={`sp-chip${status === '' ? ' is-active' : ''}`} onClick={() => setStatus('')}>All</button>
          {COMPLAINT_STATUS_OPTIONS.map((option) => (
            <button key={option.value} type="button" className={`sp-chip${status === option.value ? ' is-active' : ''}`} onClick={() => setStatus(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary btn--small" onClick={() => setDrawerOpen(true)}>Log complaint</button>
      </section>

      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {state.status === 'loading' ? <p className="data-state" role="status">Loading your tickets…</p> : null}

      {state.status !== 'loading' && !state.error && state.rows.length === 0 ? (
        <div className="app-empty sp-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{status ? 'No tickets with this status' : 'No complaints logged'}</h2>
          <p>{status ? 'Try another status to see the rest of your tickets.' : 'Log a complaint and operations will resolve it. You are notified at every step.'}</p>
          {status ? <button type="button" className="btn btn--outline btn--small" onClick={() => setStatus('')}>Show all</button> : <button type="button" className="btn btn--primary btn--small" onClick={() => setDrawerOpen(true)}>Log a complaint</button>}
        </div>
      ) : null}

      {state.rows.length > 0 ? (
        <ul className="sp-ticketcards">
          {state.rows.map((ticket) => (
            <li key={ticket.id} className="sp-ticketcard">
              <header>
                <div>
                  <span className="sp-ref">{ticket.reference}</span>
                  <h3>{ticket.title}</h3>
                  <p>{[ticket.customerName, ticket.phone, ticket.category].filter(Boolean).join(' · ')}</p>
                </div>
                <StatusPill status={ticket.status} label={ticket.statusLabel} />
              </header>
              {ticket.description ? <p className="sp-ticketcard__body">{ticket.description}</p> : null}
              {ticket.resolution ? <p className="sp-ticketcard__resolution"><span>Resolution</span>{ticket.resolution}</p> : null}
              <details className="sp-history">
                <summary>Status history{Array.isArray(ticket.history) && ticket.history.length ? ` (${ticket.history.length})` : ''}</summary>
                {Array.isArray(ticket.history) && ticket.history.length ? (
                  <ol>
                    {ticket.history.map((entry, index) => (
                      <li key={`${ticket.id}-${index}`}>
                        <span>{entry.statusLabel ?? entry.status}</span>
                        <p>{entry.note || 'Status updated'}</p>
                        <time>{formatDayTime(entry.at)}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p>No status changes recorded yet.</p>}
              </details>
              <footer>
                <span className="sp-block__meta">{ticket.priority} priority · logged {formatDayTime(ticket.createdAt)}</span>
              </footer>
            </li>
          ))}
        </ul>
      ) : null}

      <ComplaintDrawer open={drawerOpen} customers={customers.rows} onClose={() => setDrawerOpen(false)} onSaved={load} />
    </div>
  );
}
