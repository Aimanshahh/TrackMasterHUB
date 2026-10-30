import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDay } from '../../app/operations.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import CustomerAvatar from '../../components/salesperson/CustomerAvatar.jsx';
import IntakeDrawer from '../../components/salesperson/IntakeDrawer.jsx';

const priorityLabel = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

export default function SalespersonCustomersPage() {
  useDocumentTitle('My customers');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ category: '', priority: '', followUp: '' });
  const [sort, setSort] = useState({ sort: 'createdAt', direction: 'desc' });
  const [intakeOpen, setIntakeOpen] = useState(false);

  const customers = useCustomers({ search, ...filters, ...sort, limit: 100 });
  const rows = customers.rows;

  function toggleSort(field) {
    setSort((current) => (
      current.sort === field
        ? { sort: field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { sort: field, direction: 'asc' }
    ));
  }

  return (
    <div className="sp-customers">
      <section className="sp-toolbar">
        <label className="sp-search">
          <span className="visually-hidden">Search your customers</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, company or email…" />
        </label>
        <div className="sp-toolbar__filters">
          <label>
            <span>Priority</span>
            <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
              <option value="">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <span>Follow-up</span>
            <select value={filters.followUp} onChange={(event) => setFilters((current) => ({ ...current, followUp: event.target.value }))}>
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sort.sort}
              onChange={(event) => setSort({ sort: event.target.value, direction: event.target.value === 'name' ? 'asc' : 'desc' })}
            >
              <option value="createdAt">Newest</option>
              <option value="name">Name</option>
              <option value="followUp">Follow-up date</option>
            </select>
          </label>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setIntakeOpen(true)}>Add customer</button>
      </section>

      <div className="sp-list-head">
        <span>{customers.meta?.total ?? rows.length} customer{(customers.meta?.total ?? rows.length) === 1 ? '' : 's'} in your portfolio</span>
        <button type="button" className="sp-text-btn" onClick={customers.refresh}>{customers.isFetching ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {customers.error ? <p className="app-notice app-notice--error" role="alert">{customers.error}</p> : null}
      {customers.status === 'loading' ? <p className="data-state" role="status">Loading your customers…</p> : null}

      {customers.status !== 'loading' && !customers.error && rows.length === 0 ? (
        <div className="app-empty sp-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{search || filters.priority || filters.followUp ? 'No customers match this view' : 'Your portfolio is empty'}</h2>
          <p>
            {search || filters.priority || filters.followUp
              ? 'Clear the search or filters to see every customer you own.'
              : 'Every customer you add is assigned to you and appears here. Nothing is pre-filled.'}
          </p>
          {search || filters.priority || filters.followUp ? (
            <button type="button" className="btn btn--outline btn--small" onClick={() => { setSearch(''); setFilters({ category: '', priority: '', followUp: '' }); }}>
              Clear filters
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--small" onClick={() => setIntakeOpen(true)}>Add your first customer</button>
          )}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="sp-table" role="table" aria-label="Your customers">
            <div className="sp-table__head" role="row">
              <button type="button" role="columnheader" onClick={() => toggleSort('name')}>Customer {sort.sort === 'name' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</button>
              <span role="columnheader">Contact</span>
              <span role="columnheader">Priority</span>
              <button type="button" role="columnheader" onClick={() => toggleSort('followUp')}>Follow-up {sort.sort === 'followUp' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</button>
              <span role="columnheader" aria-label="Open" />
            </div>
            {rows.map((customer) => (
              <div className="sp-table__row" role="row" key={customer.id}>
                <div className="sp-table__cell" role="cell">
                  <Link to={`/salesperson/customers/${customer.id}`} className="sp-table__name">{customer.name}</Link>
                  <span className="sp-table__sub">{customer.company || customer.category || 'No business name'}</span>
                </div>
                <div className="sp-table__cell" role="cell">
                  <span>{customer.phone || '—'}</span>
                  <span className="sp-table__sub">{customer.email || 'No email'}</span>
                </div>
                <div className="sp-table__cell" role="cell">
                  <span className="sp-priority" data-tone={customer.priority}>{priorityLabel[customer.priority] ?? customer.priority}</span>
                </div>
                <div className="sp-table__cell" role="cell">
                  <span>{formatDay(customer.followUp)}</span>
                  {customer.followUp && new Date(customer.followUp) < new Date() ? <span className="sp-late">Overdue</span> : null}
                </div>
                <div className="sp-table__cell sp-table__cell--end" role="cell">
                  <Link to={`/salesperson/customers/${customer.id}`} className="sp-open">Open</Link>
                </div>
              </div>
            ))}
          </div>

          <ul className="sp-cards">
            {rows.map((customer) => {
              const overdue = customer.followUp && new Date(customer.followUp) < new Date(new Date().toDateString());

              return (
                <li key={customer.id} className="sp-card">
                  <div className="sp-card__row">
                    <CustomerAvatar name={customer.name} tone={customer.priority} />
                    <div className="sp-card__id">
                      <Link to={`/salesperson/customers/${customer.id}`}>{customer.name}</Link>
                      <span>{customer.company || customer.category || 'Individual customer'}</span>
                    </div>
                    <span className="sp-priority" data-tone={customer.priority}>{priorityLabel[customer.priority] ?? customer.priority}</span>
                  </div>

                  <dl className="sp-card__facts">
                    <div>
                      <dt>Phone</dt>
                      <dd>{customer.phone || 'Not recorded'}</dd>
                    </div>
                    <div>
                      <dt>Follow-up</dt>
                      <dd className={overdue ? 'is-overdue' : undefined}>
                        {customer.followUp ? formatDay(customer.followUp) : 'Not planned'}
                      </dd>
                    </div>
                  </dl>

                  <div className="sp-card__foot">
                    {customer.phone ? (
                      <a className="sp-card__call" href={`tel:${customer.phone}`}>Call</a>
                    ) : (
                      <span className="sp-card__call is-disabled">No number</span>
                    )}
                    <Link to={`/salesperson/customers/${customer.id}`} className="sp-card__open">
                      Open record <span aria-hidden="true">›</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <IntakeDrawer
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSaved={() => customers.refresh()}
      />
    </div>
  );
}
