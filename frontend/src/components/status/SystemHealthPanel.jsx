import { Link } from 'react-router-dom';

import { formatTime, formatUptime } from '../../lib/format.js';

export default function SystemHealthPanel({ health }) {
  const { status, data, error, latencyMs, checkedAt, refresh, isRefreshing } = health;
  const isOnline = status === 'online';
  const isLoading = status === 'loading';

  const headline = isOnline ? 'API connected' : isLoading ? 'Contacting API' : 'API unreachable';

  const summary = isOnline
    ? `Responding in ${latencyMs} ms.`
    : isLoading
      ? 'Requesting /api/health from the backend.'
      : error;

  return (
    <section
      className={`health-panel health-panel--${status}`}
      aria-label="TrackMaster Hub API status"
    >
      <div className="health-panel__head">
        <p className="micro-label">Live system check</p>
        <span className="health-panel__state">
          <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
          {isOnline ? 'Operational' : isLoading ? 'Checking' : 'Unavailable'}
        </span>
      </div>

      <div className="health-panel__body">
        <h2 className="health-panel__headline">{headline}</h2>
        <p className="health-panel__summary" aria-live="polite">
          {summary}
        </p>

        <dl className="fact-grid">
          <div className="fact">
            <dt>Service</dt>
            <dd>{data?.service?.name ?? 'trackmaster-hub-api'}</dd>
          </div>
          <div className="fact">
            <dt>Version</dt>
            <dd>{data?.service?.version ?? '—'}</dd>
          </div>
          <div className="fact">
            <dt>Environment</dt>
            <dd>{data?.service?.environment ?? '—'}</dd>
          </div>
          <div className="fact">
            <dt>Uptime</dt>
            <dd>{data ? formatUptime(data.uptimeSeconds) : '—'}</dd>
          </div>
        </dl>

        {status === 'offline' ? (
          <button
            type="button"
            className="btn btn--outline btn--small health-panel__retry"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Retrying…' : 'Retry connection'}
          </button>
        ) : null}
      </div>

      <div className="health-panel__foot">
        <span>
          Checked {checkedAt ? formatTime(checkedAt) : '—'}
          <span className="health-panel__endpoint"> · GET /api/health</span>
        </span>
        <Link className="health-panel__link" to="/status">
          Status details
        </Link>
      </div>
    </section>
  );
}
