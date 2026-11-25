import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchSalesPerformance } from '../../lib/api.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';

const PRESETS = [
  { key: 'month', label: 'This month' },
  { key: 'week', label: 'This week' },
  { key: '30', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const LEAD_LABELS = {
  ready_for_installation: 'Ready for installation',
  vehicle_unavailable: 'Vehicle unavailable',
  rescheduled: 'Installation rescheduled',
  follow_up_required: 'Follow-up required',
  converted: 'Converted',
  lost: 'Lost',
};

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function rangeForPreset(key) {
  const now = new Date();

  if (key === 'month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (key === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { from: isoDate(start), to: isoDate(now) };
  }
  if (key === '30') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: isoDate(start), to: isoDate(now) };
  }
  if (key === 'year') {
    return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
  }
  return { from: '', to: '' };
}

function share(value, total) {
  if (!total) return null;
  return Math.round((value / total) * 100);
}

export default function SalesPerformancePage() {
  useDocumentTitle('Sales performance');

  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(() => rangeForPreset('month').from);
  const [to, setTo] = useState(() => rangeForPreset('month').to);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [sort, setSort] = useState({ key: 'revenue', direction: 'desc' });
  const [selectedId, setSelectedId] = useState(null);

  function applyPreset(key) {
    setPreset(key);
    const next = rangeForPreset(key);
    setFrom(next.from);
    setTo(next.to);
  }

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.data ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchSalesPerformance({ from, to }, { signal });
      setState({ status: 'ready', data: payload.data, error: null });
      setSelectedId((current) => (payload.data?.bySalesperson ?? []).some((row) => row.id === current) ? current : payload.data?.bySalesperson?.[0]?.id ?? null);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [from, to]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const data = state.data;
  const rows = useMemo(() => {
    const list = [...(data?.bySalesperson ?? [])];
    return list.sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      const left = a[sort.key] ?? 0;
      const right = b[sort.key] ?? 0;
      if (left === right) return a.name.localeCompare(b.name);
      return left > right ? direction : -direction;
    });
  }, [data, sort]);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  function toggleSort(key) {
    setSort((current) => (current.key === key
      ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
      : { key, direction: 'desc' }));
  }

  const sortMark = (key) => (sort.key === key ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : '');

  const totals = data?.totals;
  const rangeLabel = data?.range?.allTime
    ? 'All time'
    : `${from ? formatDateTime(`${from}T00:00:00`) : 'the beginning'} – ${to ? formatDateTime(`${to}T00:00:00`) : 'today'}`;

  return (
    <div className="field-page">
      <section className="perf-controls">
        <div className="perf-presets" role="group" aria-label="Date range">
          {PRESETS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`perf-preset${preset === entry.key ? ' is-active' : ''}`}
              onClick={() => applyPreset(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="perf-dates">
          <label className="perf-date">
            <span>From</span>
            <input type="date" value={from} onChange={(event) => { setPreset('custom'); setFrom(event.target.value); }} />
          </label>
          <label className="perf-date">
            <span>To</span>
            <input type="date" value={to} onChange={(event) => { setPreset('custom'); setTo(event.target.value); }} />
          </label>
          <button type="button" className="btn btn--outline btn--small" onClick={() => load()}>Refresh</button>
        </div>
      </section>

      <p className="perf-range">Showing <strong>{rangeLabel}</strong>. Month and week columns always describe the current month and week.</p>

      {state.error ? (
        <div className="field-alert" role="alert">
          <p>{state.error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={() => load()}>Try again</button>
        </div>
      ) : null}

      {state.status === 'loading' && !data ? <p className="data-state">Counting sales…</p> : null}

      {totals ? (
        <>
          <div className="perf-strip">
            <div><span>Revenue</span><strong>{formatMoney(totals.revenue)}</strong></div>
            <div><span>Sales</span><strong>{totals.sales}</strong></div>
            <div><span>Completed</span><strong>{totals.completed}</strong></div>
            <div><span>Pending</span><strong>{totals.pending}</strong></div>
            <div><span>Awaiting approval</span><strong>{totals.awaitingApproval}</strong></div>
            <div><span>Cancelled</span><strong>{totals.cancelled}</strong></div>
          </div>

          <div className="perf-compare">
            <div>
              <span>This month</span>
              <strong>{formatMoney(totals.monthRevenue)}</strong>
              <em>{totals.monthSales} sale{totals.monthSales === 1 ? '' : 's'}</em>
            </div>
            <div>
              <span>This week</span>
              <strong>{formatMoney(totals.weekRevenue)}</strong>
              <em>{totals.weekSales} sale{totals.weekSales === 1 ? '' : 's'}</em>
            </div>
            <div>
              <span>Average sale</span>
              <strong>{totals.averageSale === null ? '—' : formatMoney(totals.averageSale)}</strong>
              <em>across {totals.sales} sale{totals.sales === 1 ? '' : 's'} in range</em>
            </div>
          </div>

          <section className="field-block">
            <header className="field-block__head">
              <h2>Salesperson performance</h2>
              <p>Ranked by revenue generated in the selected range. Every figure comes from stored installations; completed means the vehicle was installed, pending means it is still with operations.</p>
            </header>

            {rows.length ? (
              <div className="field-table-wrap">
                <table className="field-table perf-table">
                  <thead>
                    <tr>
                      <th aria-label="Rank">#</th>
                      <th>Salesperson</th>
                      <th><button type="button" className="perf-sort" onClick={() => toggleSort('sales')}>Sales{sortMark('sales')}</button></th>
                      <th><button type="button" className="perf-sort" onClick={() => toggleSort('completed')}>Completed{sortMark('completed')}</button></th>
                      <th><button type="button" className="perf-sort" onClick={() => toggleSort('pending')}>Pending{sortMark('pending')}</button></th>
                      <th><button type="button" className="perf-sort" onClick={() => toggleSort('cancelled')}>Cancelled{sortMark('cancelled')}</button></th>
                      <th><button type="button" className="perf-sort" onClick={() => toggleSort('revenue')}>Revenue{sortMark('revenue')}</button></th>
                      <th>This month</th>
                      <th>Hot leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`perf-row${selected?.id === row.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="perf-rank">{String(index + 1).padStart(2, '0')}</td>
                        <td>
                          <span className="perf-name">{row.name}</span>
                          {row.completionRate !== null ? <span className="perf-under"> {row.completionRate}% completed</span> : null}
                        </td>
                        <td>{row.sales}</td>
                        <td>{row.completed}</td>
                        <td>{row.pending}</td>
                        <td>{row.cancelled}</td>
                        <td><strong>{formatMoney(row.revenue)}</strong></td>
                        <td className="field-table__muted">{row.monthSales} · {formatMoney(row.monthRevenue)}</td>
                        <td>{row.hotLeads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="field-empty">
                <p className="field-empty__title">No sales in this range</p>
                <p>Once a salesperson submits an installation it is counted here. Change the date range to look at an earlier period — nothing is estimated or filled in.</p>
              </div>
            )}
          </section>

          {selected ? (
            <section className="perf-person">
              <header>
                <div>
                  <p className="perf-person__eyebrow">Salesperson</p>
                  <h3>{selected.name}</h3>
                </div>
                <div className="perf-person__share">
                  <span>Share of revenue</span>
                  <strong>{share(selected.revenue, totals.revenue) ?? 0}%</strong>
                </div>
              </header>

              <dl className="perf-facts">
                <div><dt>Revenue in range</dt><dd>{formatMoney(selected.revenue)}</dd></div>
                <div><dt>Average sale</dt><dd>{selected.averageSale === null ? '—' : formatMoney(selected.averageSale)}</dd></div>
                <div><dt>Completed / pending</dt><dd>{selected.completed} / {selected.pending}</dd></div>
                <div><dt>This week</dt><dd>{selected.weekSales} · {formatMoney(selected.weekRevenue)}</dd></div>
                <div><dt>Agent-assisted</dt><dd>{selected.agentSales ? `${selected.agentSales} · ${formatMoney(selected.agentCommission)} commission` : 'None'}</dd></div>
                <div><dt>Last sale</dt><dd>{selected.lastSaleAt ? formatDateTime(selected.lastSaleAt) : '—'}</dd></div>
              </dl>

              {selected.id !== 'unknown' ? (
                <Link className="btn btn--outline btn--small" to={`/admin/users/${selected.id}/performance`}>
                  Open full sales history
                </Link>
              ) : null}
            </section>
          ) : null}

          <section className="field-block">
            <header className="field-block__head">
              <h2>Agent-assisted sales</h2>
              <p>Commission is separate from salesperson performance. It is only paid when the admin records it on the sale.</p>
            </header>

            {data.agents.length ? (
              <div className="field-table-wrap">
                <table className="field-table">
                  <thead><tr><th>Agent</th><th>Sales</th><th>Commission</th><th>Paid</th><th>Pending</th></tr></thead>
                  <tbody>
                    {data.agents.map((row) => (
                      <tr key={row.name}>
                        <td><strong>{row.name}</strong>{row.phone ? <span className="field-table__muted"> · {row.phone}</span> : null}</td>
                        <td>{row.sales}</td>
                        <td>{formatMoney(row.commission)}</td>
                        <td>{formatMoney(row.paid)}</td>
                        <td>{row.pending ? <strong>{formatMoney(row.pending)}</strong> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="field-empty field-empty--tight">
                <p className="field-empty__title">No agent-assisted sales in this range</p>
                <p>When a salesperson records a sale as Agent-introduced it appears here with its commission.</p>
              </div>
            )}
          </section>

          <section className="field-block">
            <header className="field-block__head">
              <h2>Hot leads</h2>
              <p>Customers who agreed to buy but are not installed yet, across the whole business.</p>
            </header>

            {data.hotLeads.length ? (
              <div className="field-table-wrap">
                <table className="field-table">
                  <thead><tr><th>Customer</th><th>Status</th><th>Reason</th><th>Next follow-up</th><th>Owner</th></tr></thead>
                  <tbody>
                    {data.hotLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td><strong>{lead.name}</strong>{lead.phone ? <span className="field-table__muted"> · {lead.phone}</span> : null}</td>
                        <td>{LEAD_LABELS[lead.status] ?? lead.status}</td>
                        <td className="field-table__muted">{lead.reason || '—'}</td>
                        <td className="field-table__muted">{lead.nextFollowUp ? formatDateTime(lead.nextFollowUp) : '—'}</td>
                        <td>{lead.owner || 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="field-empty field-empty--tight">
                <p className="field-empty__title">No open hot leads</p>
                <p>Salespeople flag interested customers from the Hot leads screen; those records show up here.</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
