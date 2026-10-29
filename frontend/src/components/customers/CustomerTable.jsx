import { useMemo, useState } from 'react';

export default function CustomerTable({ customers, onSelect, showToolbar = true }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = customers.filter((customer) => {
      if (!query) return true;
      return (
        [customer.name, customer.email, customer.category, customer.priority].join(' ').toLowerCase().includes(query)
      );
    });

    if (sort) {
      rows.sort((a, b) => {
        if (sort.field === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sort.field === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });
    }

    return rows;
  }, [customers, search, sort]);

  const columns = [
    { key: 'name', label: 'Customer' },
    { key: 'email', label: 'Email' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' },
    { key: 'createdAt', label: 'Created' },
  ];

  return (
    <div className="customer-table">
      {showToolbar ? <div className="customer-table__toolbar">
        <div className="customer-table__search">
          <span className="customer-table__search-icon" aria-hidden="true">
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8.5 8.5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="customer-table__search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers…"
            aria-label="Search customers"
          />
        </div>

        <div className="customer-table__sort">
          <label htmlFor="customer-sort">Sort by</label>
          <select
            id="customer-sort"
            className="customer-table__sort-select"
            value={sort ? sort.field : ''}
            onChange={(event) => setSort(event.target.value ? { field: event.target.value } : null)}
          >
            <option value="">Default</option>
            <option value="name">Name</option>
            <option value="createdAt">Newest</option>
          </select>
        </div>
      </div> : null}

      <div className="customer-table__body">
        <div className="customer-table__header">
          <div className="customer-table__cell customer-table__cell--label">Customer</div>
          <div className="customer-table__cell customer-table__cell--label">Email</div>
          <div className="customer-table__cell customer-table__cell--label">Category</div>
          <div className="customer-table__cell customer-table__cell--label">Priority</div>
          <div className="customer-table__cell customer-table__cell--label">Created</div>
        </div>

        {filtered.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className="customer-table__row"
            onClick={() => onSelect?.(customer.id)}
          >
            <div className="customer-table__cell">
              <span className="customer-table__name">{customer.name}</span>
              <span className="customer-table__meta">{customer.id}</span>
            </div>
            <div className="customer-table__cell customer-table__cell--muted">{customer.email}</div>
            <div className="customer-table__cell">{customer.category}</div>
            <div className="customer-table__cell">{customer.priority}</div>
            <div className="customer-table__cell customer-table__cell--muted">{customer.createdAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(customer.createdAt)) : '—'}</div>
          </button>
        ))}

        {filtered.length === 0 ? (
          <div className="customer-table__empty">
            <p>No customers match your search.</p>
            <p>Add a customer to see their record here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
