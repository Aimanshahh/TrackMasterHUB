import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { fetchCustomer } from '../../lib/api.js';

export default function CustomerDrawer({ open, onClose, customerId }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!!customerId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !customerId) return;

    let active = true;

    fetchCustomer(customerId)
      .then((payload) => {
        if (!active) return;
        setCustomer(payload.data.customer);
        setLoading(false);
      })
      .catch((error_) => {
        if (!active) return;
        setError(error_.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customerId, open]);

  if (!open) return null;

  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="drawer">
        <div className="drawer__head">
          <p className="drawer__eyebrow">Customer</p>
          <h2 className="drawer__title">{customer?.name ?? 'Customer details'}</h2>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="drawer__empty">Loading customer details…</p>
        ) : error ? (
          <p className="drawer__empty" role="alert">{error}</p>
        ) : customer ? (
          <div className="drawer__form">
            <dl className="drawer__details">
              <div>
                <dt>Name</dt>
                <dd>{customer.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{customer.email}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{customer.category}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{customer.priority}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{customer.owner ?? '—'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{customer.createdAt ?? '—'}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="drawer__foot">
          <button type="button" className="btn btn--primary" onClick={() => navigate(-1)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
