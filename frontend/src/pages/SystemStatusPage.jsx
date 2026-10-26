import { useSystemHealth } from '../context/systemHealth.js';
import { formatDateTime, formatTime, formatUptime } from '../lib/format.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const statusLabels = {
  loading: 'Checking',
  online: 'Operational',
  offline: 'Unavailable',
};

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd className={mono ? 'is-mono' : undefined}>{value}</dd>
    </div>
  );
}

export default function SystemStatusPage() {
  useDocumentTitle('System status');
  const { status, data, error, latencyMs, checkedAt, refresh, isRefreshing, refreshIntervalMs } =
    useSystemHealth();

  return (
    <>
      <section className="page-head">
        <div className="container page-head__inner">
          <div className="page-head__main">
            <p className="eyebrow">
              <span className="eyebrow__mark" aria-hidden="true" />
              Platform · Service status
            </p>
            <h1 className="page-title">System status</h1>
            <p className="page-head__body">
              The live response from the TrackMaster Hub API, read through the web client&rsquo;s
              own origin. This is the same endpoint the interface uses to confirm it can reach the
              backend.
            </p>
          </div>

          <div className={`page-head__state page-head__state--${status}`}>
            <span className="page-head__state-row">
              <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
              {statusLabels[status]}
            </span>
            <span className="page-head__meta">
              Checked {checkedAt ? formatTime(checkedAt) : '—'}
            </span>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container status-layout">
          <div className="status-card">
            <div className="status-card__head">
              <div>
                <h2 className="status-card__title">API health</h2>
                <p className="status-card__subtitle">
                  {status === 'online'
                    ? 'The Express service is responding normally.'
                    : status === 'loading'
                      ? 'Contacting the service…'
                      : 'The web client could not reach the API.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--outline btn--small"
                onClick={refresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Checking…' : 'Refresh now'}
              </button>
            </div>

            {error ? (
              <p className="notice" role="status">
                {error}
              </p>
            ) : null}

            <dl className="detail-list">
              <DetailRow label="Status" value={statusLabels[status]} />
              <DetailRow
                label="Response time"
                value={latencyMs ? `${latencyMs} ms` : '—'}
                mono
              />
              <DetailRow label="Service" value={data?.service?.name ?? 'trackmaster-hub-api'} mono />
              <DetailRow label="Version" value={data?.service?.version ?? '—'} mono />
              <DetailRow label="Environment" value={data?.service?.environment ?? '—'} mono />
              <DetailRow
                label="Process uptime"
                value={data ? formatUptime(data.uptimeSeconds) : '—'}
              />
              <DetailRow
                label="Process started"
                value={data ? formatDateTime(data.startedAt) : '—'}
              />
              <DetailRow
                label="Last checked"
                value={checkedAt ? formatDateTime(checkedAt) : '—'}
              />
              <DetailRow label="Endpoint" value="/api/health" mono />
            </dl>

            <p className="status-card__foot">
              Refreshes automatically every {Math.round(refreshIntervalMs / 1000)} seconds. A
              failed check is shown as unavailable, never as healthy.
            </p>
          </div>

          <aside className="status-aside">
            <h2 className="status-aside__title">What this check proves</h2>
            <p className="status-aside__body">
              The browser can reach the Express application, the route is mounted and the API is
              returning valid JSON. It does not by itself prove that every future dependency is
              healthy.
            </p>

            <h2 className="status-aside__title">Planned checks</h2>
            <ul className="check-list">
              <li>
                <span>Database connectivity</span>
                <em>With the MongoDB connection</em>
              </li>
              <li>
                <span>Authentication service</span>
                <em>Phase 2</em>
              </li>
              <li>
                <span>Live tracking API</span>
                <em>After API discovery</em>
              </li>
            </ul>

            <p className="status-aside__note">
              Checks that are not implemented are listed as planned, not reported as operational.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
