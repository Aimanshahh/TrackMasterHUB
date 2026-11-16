import { useState } from 'react';

import { useCustomers } from '../../hooks/useCustomers.js';

function customerLabel(customer) {
  return [customer.name, customer.phone, customer.email].filter(Boolean).join(' · ');
}

export default function CustomerPicker({ value, onChange, required = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const customers = useCustomers({ search: query, limit: 20 });

  function handleSearch(event) {
    setQuery(event.target.value);
    onChange('');
    setOpen(true);
  }

  function selectCustomer(customer) {
    setQuery(customerLabel(customer));
    onChange(customer.id);
    setOpen(false);
  }

  const hasSearch = query.trim().length > 0;

  return (
    <div className="customer-picker">
      <input
        className="input"
        required={required && !value}
        value={query}
        onChange={handleSearch}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, phone or email…"
        aria-label="Search customers by name, phone or email"
        aria-autocomplete="list"
        aria-expanded={open && hasSearch}
      />
      {open && hasSearch ? (
        <div className="customer-picker__results" role="listbox">
          {customers.status === 'loading' || customers.status === 'refreshing' ? (
            <p className="customer-picker__status">Searching customers…</p>
          ) : customers.status === 'error' ? (
            <p className="customer-picker__status customer-picker__status--error">{customers.error}</p>
          ) : customers.rows.length > 0 ? (
            customers.rows.map((customer) => (
              <button
                type="button"
                className={`customer-picker__option${customer.id === value ? ' is-selected' : ''}`}
                key={customer.id}
                role="option"
                aria-selected={customer.id === value}
                onClick={() => selectCustomer(customer)}
              >
                <strong>{customer.name}</strong>
                <span>{[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No phone or email recorded'}</span>
              </button>
            ))
          ) : (
            <p className="customer-picker__status">No customers match that search.</p>
          )}
        </div>
      ) : null}
      {value ? <span className="field__hint">Selected customer: {query}</span> : null}
    </div>
  );
}
