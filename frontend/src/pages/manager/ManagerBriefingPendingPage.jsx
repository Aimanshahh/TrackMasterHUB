import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { daysSince, formatDay, waitingLabel } from '../../app/operations.js';
import { useBriefingPending } from '../../hooks/useBriefingPending.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/**
 * Customers whose vehicle is installed but whose account stays inactive until
 * the security briefing is completed. Longest-waiting customer first.
 */
export default function ManagerBriefingPendingPage() {
  useDocumentTitle('Briefing pending');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const pending = useBriefingPending({ q: search });
  const total = pending.meta?.total ?? pending.rows.length;

  return (
    <div className="mgr-customers">
      <div className="lookup-bar">
        <div className="lookup-bar__field">
          <span className="lookup-bar__label">Find a customer</span>
          <input
            className="input"
            aria-label="Search customers waiting for a briefing"
            placeholder="Name, phone or company…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="lookup-bar__count">{total} {total === 1 ? 'customer' : 'customers'} waiting</span>
      </div>

      {pending.error ? <p className="app-notice app-notice--error" role="alert">This list is unavailable: {pending.error}</p> : null}
      {pending.status === 'loading' ? <p className="data-state" role="status">Loading customers…</p> : null}

      {pending.status !== 'loading' && !pending.error && pending.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{search ? 'No waiting customer matches this search' : 'No briefings waiting'}</h2>
          <p>{search ? 'Try a phone number, or clear the search.' : 'Every customer with a completed installation has had their security briefing.'}</p>
        </div>
      ) : null}

      {pending.rows.length > 0 ? (
        <div className="ledger-scroll">
          <table className="ledger ledger--customers">
            <thead>
              <tr>
                <th scope="col">Waiting</th>
                <th scope="col">Customer</th>
                <th scope="col">Phone</th>
                <th scope="col">Vehicles installed</th>
                <th scope="col">Salesperson</th>
                <th scope="col" className="ledger__action-col"><span className="ledger__sr">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {pending.rows.map((customer) => {
                const days = daysSince(customer.waitingSince);
                return (
                  <tr
                    key={customer.id}
                    className="ledger__row--link"
                    onClick={() => navigate(`/manager/customers/${customer.id}`)}
                  >
                    <td>
                      <span className="ledger__strong" data-late={days >= 3}>{waitingLabel(days)}</span>
                      <span className="ledger__sub">since {formatDay(customer.waitingSince)}</span>
                    </td>
                    <td>
                      <Link className="ledger__link" to={`/manager/customers/${customer.id}`}>{customer.name}</Link>
                      <span className="ledger__sub">{customer.company || ' '}</span>
                    </td>
                    <td>
                      {customer.phone ? (
                        <a className="ledger__link" href={`tel:${customer.phone}`} onClick={(event) => event.stopPropagation()}>{customer.phone}</a>
                      ) : '—'}
                    </td>
                    <td>
                      {customer.vehicles.map((vehicle) => (
                        <span className="ledger__sub" key={`${vehicle.registration}-${vehicle.label}`}>
                          {[vehicle.label, vehicle.registration].filter(Boolean).join(' · ') || 'Vehicle'}
                        </span>
                      ))}
                    </td>
                    <td><span className="ledger__muted">{customer.owner?.name || 'Unassigned'}</span></td>
                    <td className="ledger__action-col">
                      <Link
                        className="ledger__open"
                        to={`/manager/customers/${customer.id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Complete briefing
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ledger-note">
        The account stays inactive until the briefing is completed. Installation alone does not activate it. CNIC, date of birth and other
        briefing details are only shown on the customer's own record.
      </p>
    </div>
  );
}
