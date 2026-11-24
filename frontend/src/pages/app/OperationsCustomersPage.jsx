import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { searchDeskCustomers } from '../../lib/api.js';

const MIN_CHARS = 2;

/**
 * Search-first customer screen. Nothing is loaded until the desk types a name,
 * a phone number or a registration, so the page opens instantly however large
 * the customer base is.
 */
export default function OperationsCustomersPage() {
  useDocumentTitle('Customers');
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [term, setTerm] = useState('');
  const [state, setState] = useState({ status: 'idle', rows: [], meta: null, error: null });

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < MIN_CHARS) {
      setState({ status: 'idle', rows: [], meta: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    const timer = setTimeout(() => {
      searchDeskCustomers(query, { signal: controller.signal })
        .then((payload) => setState({ status: 'done', rows: payload.data ?? [], meta: payload.meta ?? null, error: null }))
        .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', rows: [], meta: null, error: error.message }); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const open = (customer) => navigate(`/operations/customers/${customer.id}`);

  return (
    <div className="desk-search">
      <div className="desk-search__box">
        <label htmlFor="desk-search-input">Find a customer</label>
        <input
          id="desk-search-input"
          ref={inputRef}
          className="desk-search__input"
          type="search"
          autoComplete="off"
          placeholder="Search by name, phone number or VRN"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
        <p className="desk-search__hint">Type at least {MIN_CHARS} characters. Results appear only after you search.</p>
      </div>

      {state.status === 'idle' ? (
        <div className="desk-search__empty">
          <h2>Search to see customers</h2>
          <p>Start typing a name, a phone number such as 0300…, or a vehicle registration to open a customer profile.</p>
        </div>
      ) : null}
      {state.status === 'loading' ? <p className="data-state" role="status">Searching…</p> : null}
      {state.status === 'error' ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}

      {state.status === 'done' ? (
        state.rows.length === 0 ? (
          <div className="desk-search__empty"><h2>No customer found</h2><p>Check the spelling, or try the phone number or registration instead.</p></div>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger ledger--stack desk-results">
              <thead>
                <tr><th>Customer</th><th>Phone</th><th>Category</th><th>Vehicles</th><th>Matched VRN</th></tr>
              </thead>
              <tbody>
                {state.rows.map((customer) => (
                  <tr key={customer.id} tabIndex={0} className="vehicles-table__row" onClick={() => open(customer)} onKeyDown={(event) => { if (event.key === 'Enter') open(customer); }}>
                    <td data-label="Customer"><strong>{customer.name}</strong>{customer.company ? <small className="desk-results__sub">{customer.company}</small> : null}</td>
                    <td data-label="Phone" className="mono">{customer.phone || '—'}</td>
                    <td data-label="Category">{customer.category || '—'}</td>
                    <td data-label="Vehicles">{customer.vehicleCount}</td>
                    <td data-label="Matched VRN" className="mono">{customer.matchedVrn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.meta?.more ? <p className="panel__note">Showing the first {state.meta.limit} matches. Type more of the name, number or VRN to narrow it down.</p> : null}
          </div>
        )
      ) : null}
    </div>
  );
}
