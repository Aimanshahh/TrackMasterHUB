import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import CustomerAccountView from '../../components/customers/CustomerAccountView.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchDeskCustomer } from '../../lib/api.js';

/** Operations view of one customer: contact, app login, vehicles and history, without the money records. */
export default function OperationsCustomerDetailPage() {
  const { customerId } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async (signal) => {
    try {
      const payload = await fetchDeskCustomer(customerId, { signal });
      setState({ status: 'ready', data: payload.data, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message });
    }
  }, [customerId]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useDocumentTitle(state.data?.customer?.name ? `${state.data.customer.name} · Customer` : 'Customer');

  if (state.status === 'loading') return <p className="data-state" role="status">Loading customer…</p>;
  if (state.status === 'error') {
    return (
      <div className="app-empty">
        <span className="app-empty__mark" aria-hidden="true">—</span>
        <h2>This customer could not be opened</h2>
        <p>{state.error}</p>
      </div>
    );
  }

  return (
    <div className="mgr-account-page">
      <CustomerAccountView
        data={state.data}
        variant="operations"
        backTo="/operations/customers"
        backLabel="Customer search"
        onVehicleSaved={() => load()}
      />
    </div>
  );
}
