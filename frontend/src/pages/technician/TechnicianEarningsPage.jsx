import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianEarnings } from '../../hooks/useTechnician.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';

export default function TechnicianEarningsPage() {
  useDocumentTitle('Earnings');
  const { data, status, error, refresh } = useTechnicianEarnings();

  const totals = data?.totals;
  const rates = data?.rates;

  return (
    <div className="tech-page">
      {status === 'loading' ? <p className="tech-state">Loading your earnings…</p> : null}
      {error ? (
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refresh}>Try again</button>
        </div>
      ) : null}

      {totals ? (
        <>
          <section className="tech-balance">
            <p className="tech-balance__label">Outstanding balance</p>
            <p className="tech-balance__value">{formatMoney(totals.balance)}</p>
            <p className="tech-balance__meta">
              {formatMoney(totals.earned)} earned across {totals.installations} approved installation{totals.installations === 1 ? '' : 's'} · {formatMoney(totals.paid)} paid
            </p>
          </section>

          <section className="tech-section">
            <div className="tech-section__head"><h2>Your rate</h2></div>
            <dl className="tech-rate">
              <div><dt>Normal installation</dt><dd>{rates?.normal === null || rates?.normal === undefined ? 'Not set' : formatMoney(rates.normal)}</dd></div>
              <div><dt>Redo installation</dt><dd>{rates?.redo === null || rates?.redo === undefined ? 'Not set' : formatMoney(rates.redo)}</dd></div>
              <div><dt>Additional charges</dt><dd>{formatMoney(rates?.additional ?? 0)}</dd></div>
            </dl>
            <p className="tech-note">
              Rates are set by the admin. An earning is created when operations approves an installation, and keeps the rate that applied at that moment.
            </p>
          </section>

          <section className="tech-section">
            <div className="tech-section__head"><h2>Approved installations</h2></div>
            {data.earnings.length ? (
              <ul className="tech-stock">
                {data.earnings.map((row) => (
                  <li key={row.id} className="tech-stock__row">
                    <div>
                      <p className="tech-stock__id">{row.customerName || row.reference}</p>
                      <p className="tech-stock__meta">
                        {row.typeLabel} · {row.vehicleRegistration || 'No registration'}
                        {row.reversed ? ' · reversed' : ''}
                      </p>
                    </div>
                    <div className="tech-stock__right">
                      <span className={`tech-amount${row.reversed ? ' tech-amount--muted' : ''}`}>{formatMoney(row.amount)}</span>
                      <span className="tech-stock__date">{formatDateTime(row.earnedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tech-empty">
                <p className="tech-empty__title">No earnings recorded yet</p>
                <p>Your earnings appear here after operations approves an installation you completed.</p>
              </div>
            )}
          </section>

          <section className="tech-section">
            <div className="tech-section__head"><h2>Payments received</h2></div>
            {data.payments.length ? (
              <ul className="tech-stock">
                {data.payments.map((row) => (
                  <li key={row.id} className="tech-stock__row">
                    <div>
                      <p className="tech-stock__id">{formatMoney(row.amount)}</p>
                      <p className="tech-stock__meta">{row.methodLabel}{row.referenceNumber ? ` · ${row.referenceNumber}` : ''}{row.remarks ? ` · ${row.remarks}` : ''}</p>
                    </div>
                    <div className="tech-stock__right">
                      <span className="tech-stock__date">{formatDateTime(row.paidAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tech-empty">
                <p className="tech-empty__title">No payments received yet</p>
                <p>Payments recorded by the admin appear here with their date, method and reference.</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
