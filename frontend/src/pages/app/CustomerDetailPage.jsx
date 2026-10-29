import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCustomer } from '../../lib/api.js';

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const [state, setState] = useState({ status: 'loading', customer: null, error: null });
  useDocumentTitle(state.customer?.name ?? 'Customer');

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomer(customerId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', customer: payload.data.customer, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', customer: null, error: error.message });
      });
    return () => controller.abort();
  }, [customerId]);

  return <Panel heading="Customer record">
    <p className="panel__note"><Link className="panel__link" to="/admin/customers">← Back to customers</Link></p>
    {state.status === 'loading' ? <p className="data-state" role="status">Loading customer…</p> : null}
    {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
    {state.customer ? <dl className="customer-detail">{[['Name', state.customer.name], ['Email', state.customer.email], ['Phone', state.customer.phone], ['Company', state.customer.company], ['Category', state.customer.category], ['Priority', state.customer.priority], ['Owner', state.customer.owner?.name], ['Follow-up', state.customer.followUp ? new Date(state.customer.followUp).toLocaleDateString() : null], ['Notes', state.customer.notes]].filter(([, value]) => value).map(([label, value]) => <div className="customer-detail__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
  </Panel>;
}
