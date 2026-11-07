import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchSalespersonPerformance } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
}

const statusLabel = (value) => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SalespersonPerformancePage() {
  const { id } = useParams();
  useDocumentTitle('Salesperson performance');
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchSalespersonPerformance(id, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', data: payload.data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }); });
    return () => controller.abort();
  }, [id]);

  if (state.status === 'loading') return <p className="data-state" role="status">Loading salesperson profile…</p>;
  if (state.error) return <p className="app-notice app-notice--error" role="alert">{state.error}</p>;

  const { salesperson, metrics, recent } = state.data;
  const metricCards = [
    ['Customers handled', metrics.customers],
    ['Installations completed', metrics.completedRequests],
    ['Installations in progress', metrics.openRequests],
    ['Follow-ups planned', metrics.followUps],
    ['Follow-ups overdue', metrics.overdueFollowUps],
    ['Sales value', formatMoney(metrics.quotedRevenue)],
    ['Customer complaints', metrics.complaints],
    ['Approvals waiting', metrics.pendingApprovals],
  ];

  return (
    <div className="sales-performance">
      <Link className="backlink" to="/admin/users">← Team accounts</Link>
      <section className="sales-performance__hero">
        <div>
          <p className="app-page-head__eyebrow">SALESPERSON RECORD</p>
          <h2>{salesperson.name}</h2>
          <p>{salesperson.email} · {salesperson.active ? 'Active account' : 'Inactive account'} · Joined {formatDate(salesperson.createdAt)}</p>
        </div>
        <div className="sales-performance__score"><strong>{metrics.completedRequests}</strong><span>installations completed</span></div>
      </section>

      <div className="sales-performance__metrics">
        {metricCards.map(([label, value]) => <div className="sales-performance__metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>

      <div className="sales-performance__grid">
        <Panel heading="Recent customers">
          <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Customer</th><th>Package</th><th>Added</th></tr></thead><tbody>
            {recent.customers.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.phone || 'No phone'}</small></td><td>{row.packageKey || '—'}</td><td>{formatDate(row.createdAt)}</td></tr>)}
          </tbody></table></div>
        </Panel>
        <Panel heading="Installation progress">
          <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Reference</th><th>Customer</th><th>Status</th></tr></thead><tbody>
            {recent.jobs.map((row) => <tr key={row.id}><td>{row.reference}</td><td>{row.customerName || '—'}</td><td><span className="status-badge">{statusLabel(row.status)}</span></td></tr>)}
          </tbody></table></div>
        </Panel>
        <Panel heading="Follow-ups and other work">
          <div className="sales-performance__split">
            <div><strong>{metrics.followUps} follow-ups</strong><span>{metrics.overdueFollowUps} overdue</span></div>
            <div><strong>{metrics.approved} approvals accepted</strong><span>{metrics.approvals} total approval requests</span></div>
          </div>
          <div className="sales-performance__activity">
            {recent.activity.slice(0, 6).map((row, index) => <div key={`${row.type}-${row.createdAt}-${index}`}><strong>{row.label}</strong><span>{formatDate(row.createdAt)} · {row.description}</span></div>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}
