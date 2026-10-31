import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AccountStateTag } from '../../components/manager/BriefingPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useManagerCustomers } from '../../hooks/useManager.js';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function ManagerCustomersPage() {
  useDocumentTitle('Customer lookup');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const customers = useManagerCustomers({ q: search, accountStatus: status });

  return (
    <div className="mgr-customers">
      <div className="lookup-bar">
        <div className="lookup-bar__field">
          <span className="lookup-bar__label">Find a customer</span>
          <input
            className="input"
            aria-label="Search customers"
            placeholder="Name, phone, email, company or category…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="lookup-bar__select">
          <span>Account state</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All records</option>
            <option value="active">Active accounts</option>
            <option value="inactive">Briefing pending</option>
          </select>
        </label>
        <span className="lookup-bar__count">
          {customers.meta?.total ?? customers.rows.length} {(customers.meta?.total ?? customers.rows.length) === 1 ? 'record' : 'records'}
        </span>
      </div>

      {customers.error ? <p className="app-notice app-notice--error" role="alert">Customer records are unavailable: {customers.error}</p> : null}
      {customers.status === 'loading' ? <p className="data-state" role="status">Loading customer records…</p> : null}

      {customers.status !== 'loading' && !customers.error && customers.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{search || status ? 'No customer matches this search' : 'No customers yet'}</h2>
          <p>{search || status ? 'Try a phone number, or clear the account filter.' : 'Customer records created by the sales team will appear here.'}</p>
        </div>
      ) : null}

      {customers.rows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger ledger--customers">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Contact</th>
                <th scope="col">Category</th>
                <th scope="col">Owner</th>
                <th scope="col" className="ledger__num">Installations</th>
                <th scope="col">Account</th>
                <th scope="col">Created</th>
                <th scope="col" className="ledger__action-col"><span className="ledger__sr">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {customers.rows.map((customer) => (
                <tr
                  key={customer.id}
                  className="ledger__row--link"
                  onClick={() => navigate(`/manager/customers/${customer.id}`)}
                >
                  <td>
                    <Link className="ledger__link" to={`/manager/customers/${customer.id}`}>{customer.name}</Link>
                    <span className="ledger__sub">{customer.company || customer.id}</span>
                  </td>
                  <td>
                    <span className="ledger__strong">{customer.phone || '—'}</span>
                    <span className="ledger__sub">{customer.email || 'No email'}</span>
                  </td>
                  <td><span className="ledger__muted">{customer.category || 'Not set'}</span></td>
                  <td><span className="ledger__muted">{customer.owner?.name || 'Unassigned'}</span></td>
                  <td className="ledger__num">
                    <span className="ledger__money">{customer.installations}</span>
                    <span className="ledger__sub">{customer.completedInstallations} completed</span>
                  </td>
                  <td><AccountStateTag customer={customer} installations={customer.installations} /></td>
                  <td className="ledger__muted">{formatDay(customer.createdAt)}</td>
                  <td className="ledger__action-col">
                    <Link
                      className="ledger__open"
                      to={`/manager/customers/${customer.id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
