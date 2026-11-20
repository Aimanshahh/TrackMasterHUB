import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDayTime } from '../../app/operations.js';
import { fetchCustomerHistory } from '../../lib/api.js';

const SHOWN = 12;

/** The latest events on one account from every source, with a link to the full printable report. */
export default function CustomerTimeline({ customerId }) {
  const [state, setState] = useState({ status: 'loading', events: [], legacy: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', events: [], legacy: [], error: null });
    fetchCustomerHistory(customerId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', events: payload.data.timeline, legacy: payload.data.legacyTimeline ?? [], error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', events: [], legacy: [], error: error.message }); });
    return () => controller.abort();
  }, [customerId]);

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Service timeline</h2>
          <p className="panel__meta">Installations, tickets, messages and billing in one list, newest first.</p>
        </div>
        <Link to={`/customers/${customerId}/report`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--small">
          Open history report
        </Link>
      </div>

      {state.status === 'loading' ? <p className="data-state" role="status">Loading timeline…</p> : null}
      {state.error ? <p className="app-notice app-notice--error" role="alert">The timeline could not be loaded: {state.error}</p> : null}
      {state.status === 'ready' && state.events.length === 0 && state.legacy.length === 0 ? <p className="data-state">Nothing has happened on this account yet.</p> : null}

      {state.events.length > 0 || state.legacy.length > 0 ? (
        <div className="ops-timeline">
          <ul>
            {state.events.slice(0, SHOWN).map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <span className="ops-timeline__mark" aria-hidden="true" />
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.source}{event.ref ? ` · ${event.ref}` : ''}{event.detail ? ` — ${event.detail}` : ''}</p>
                </div>
                <time>{formatDayTime(event.at)}</time>
              </li>
            ))}
          </ul>
          {state.events.length > SHOWN ? <p className="field__hint">Showing the latest {SHOWN} of {state.events.length}. The report has all of them.</p> : null}
          {state.legacy.length > 0 ? (
            <div className="legacy-timeline">
              <h3 className="legacy-timeline__title">Imported history</h3>
              <p className="field__hint">These records came from the old spreadsheet, which has no dates for them.</p>
              <ul>
                {state.legacy.map((event) => (
                  <li key={event.id}>
                    <span className="ops-timeline__mark ops-timeline__mark--legacy" aria-hidden="true" />
                    <div>
                      <strong>{event.title}</strong>
                      <p>{[event.vrn, event.detail].filter(Boolean).join(' · ')}</p>
                    </div>
                    <time>Date unknown</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
