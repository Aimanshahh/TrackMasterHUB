import { formatMoney } from '../../lib/format.js';

/**
 * The money position in one block: what was invoiced, what actually reached the
 * business, and what is still owed. A thin collected bar shows the share settled
 * without dressing the figure up as a chart.
 */
export default function MoneyStrip({ summary }) {
  if (!summary) {
    return <p className="data-state" role="status">Loading money totals…</p>;
  }

  const collectedShare = summary.invoiced > 0
    ? Math.min(100, Math.round((summary.collected / summary.invoiced) * 100))
    : 0;

  return (
    <section className="money-strip" aria-label="Money position">
      <div className="money-strip__lead">
        <p className="money-strip__eyebrow">Outstanding</p>
        <strong className="money-strip__figure">{formatMoney(summary.outstanding)}</strong>
        <p className="money-strip__caption">
          {summary.issuedCount === 0
            ? 'No invoice has been issued yet, so nothing is owed.'
            : `across ${summary.issuedCount} issued ${summary.issuedCount === 1 ? 'invoice' : 'invoices'}${summary.overdueCount ? ` · ${summary.overdueCount} overdue` : ''}`}
        </p>
        <div className="book-bar" role="presentation">
          <span className="book-bar__fill" style={{ width: `${collectedShare}%` }} />
        </div>
        <p className="money-strip__bar-note">{collectedShare}% of invoiced money collected</p>
      </div>

      <dl className="money-strip__figures">
        <div>
          <dt>Invoiced</dt>
          <dd>{formatMoney(summary.invoiced)}</dd>
          <small>{summary.issuedCount} issued · {summary.draftCount} to issue</small>
        </div>
        <div>
          <dt>Collected</dt>
          <dd>{formatMoney(summary.collected)}</dd>
          <small>{summary.paidCount} settled · {summary.partialCount} part paid</small>
        </div>
        <div>
          <dt>This month</dt>
          <dd>{formatMoney(summary.thisMonth?.collected ?? 0)}</dd>
          <small>{summary.thisMonth?.payments ?? 0} {(summary.thisMonth?.payments ?? 0) === 1 ? 'payment' : 'payments'} received</small>
        </div>
        <div>
          <dt>Overdue</dt>
          <dd>{summary.overdueCount ?? 0}</dd>
          <small>{summary.overdueCount ? 'past the due date with money owed' : 'nothing past due'}</small>
        </div>
      </dl>
    </section>
  );
}
