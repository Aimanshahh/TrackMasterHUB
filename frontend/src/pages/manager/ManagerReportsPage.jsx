import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useBillingSummary, useMonthlySeries } from '../../hooks/useBilling.js';
import { useManagerSummary } from '../../hooks/useManager.js';
import { formatMoney } from '../../lib/format.js';

export default function ManagerReportsPage() {
  useDocumentTitle('Reports');
  const series = useMonthlySeries(6);
  const summary = useManagerSummary();
  const billing = useBillingSummary();

  const max = Math.max(1, ...series.rows.map((row) => Math.max(row.invoiced, row.collected)));

  return (
    <div className="mgr-reports">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Invoiced against received</h2>
            <p className="panel__meta">Last six months, built from issued invoices and recorded payments only.</p>
          </div>
        </div>

        {series.error ? <p className="app-notice app-notice--error" role="alert">The monthly series is unavailable: {series.error}</p> : null}
        {series.status === 'loading' ? <p className="data-state" role="status">Building the monthly view…</p> : null}

        {series.status === 'ready' ? (
          <>
            <div className="series">
              {series.rows.map((row) => (
                <div className="series__row" key={row.month}>
                  <span className="series__label">{row.label}</span>
                  <div className="series__bars">
                    <span className="series__bar series__bar--invoiced" style={{ width: `${(row.invoiced / max) * 100}%` }} />
                    <span className="series__bar series__bar--collected" style={{ width: `${(row.collected / max) * 100}%` }} />
                  </div>
                  <span className="series__values">
                    <strong>{formatMoney(row.collected)}</strong>
                    <small>of {formatMoney(row.invoiced)}</small>
                  </span>
                </div>
              ))}
            </div>
            {series.rows.every((row) => row.invoiced === 0 && row.collected === 0) ? (
              <p className="ledger-note">No invoice has been issued in the last six months, so the chart has nothing to plot.</p>
            ) : null}
          </>
        ) : null}

        <div className="series-legend">
          <span><i className="series-legend__swatch series-legend__swatch--invoiced" aria-hidden="true" /> Invoiced</span>
          <span><i className="series-legend__swatch series-legend__swatch--collected" aria-hidden="true" /> Received</span>
        </div>
      </section>

      <div className="mgr-reports__cols">
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Money position</h2>
            <button type="button" className="btn btn--outline btn--small" onClick={billing.refresh}>Refresh</button>
          </div>
          {billing.error ? <p className="app-notice app-notice--error" role="alert">{billing.error}</p> : null}
          {billing.data ? (
            <dl className="report-figures">
              <div><dt>Invoiced</dt><dd>{formatMoney(billing.data.invoiced)}</dd><small>{billing.data.issuedCount} issued invoices</small></div>
              <div><dt>Received</dt><dd>{formatMoney(billing.data.collected)}</dd><small>{billing.data.paidCount} settled, {billing.data.partialCount} part paid</small></div>
              <div><dt>Outstanding</dt><dd data-due={billing.data.outstanding > 0}>{formatMoney(billing.data.outstanding)}</dd><small>{billing.data.overdueCount} past due</small></div>
              <div><dt>This month</dt><dd>{formatMoney(billing.data.thisMonth.collected)}</dd><small>{billing.data.thisMonth.payments} payments</small></div>
            </dl>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Accounts &amp; service</h2>
            <button type="button" className="btn btn--outline btn--small" onClick={summary.refresh}>Refresh</button>
          </div>
          {summary.error ? <p className="app-notice app-notice--error" role="alert">{summary.error}</p> : null}
          {summary.data ? (
            <dl className="report-figures">
              <div><dt>Customers</dt><dd>{summary.data.customers.total}</dd><small>{summary.data.customers.briefingDone} activated</small></div>
              <div><dt>Briefings pending</dt><dd>{summary.data.customers.briefingPending}</dd><small>installation done, account inactive</small></div>
              <div><dt>Installations in flight</dt><dd>{summary.data.installations.inFlight}</dd><small>{summary.data.installations.completed} completed</small></div>
              <div><dt>Open complaints</dt><dd>{summary.data.complaints.open}</dd><small>across every desk</small></div>
            </dl>
          ) : null}
        </section>
      </div>

      <p className="ledger-note">
        These figures count stored records. They are not refreshed automatically, so use Refresh when reviewing a period;
        a zero here means nothing has been recorded, not that a total was unavailable.
      </p>
    </div>
  );
}
