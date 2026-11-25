import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { decideQuotation, fetchQuotations, reviseQuotation, sendQuotation } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import QuotationDrawer from '../../components/sales/QuotationDrawer.jsx';

const STATUS_FILTERS = [
  { value: '', label: 'All quotations' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const TONE = { draft: 'draft', sent: 'sent', accepted: 'accepted', rejected: 'rejected', expired: 'expired' };

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/**
 * A priced offer is only useful if you can see what happened to it: who it went
 * to, what was promised, and whether it is still open. This is that register.
 */
function DecisionDialog({ quotation, open, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  if (!open || !quotation) return null;

  async function decide(status) {
    setSaving(true);
    setError(null);
    try {
      await decideQuotation(quotation.id, { status, note });
      onDone?.(status);
      onClose();
    } catch (decideError) {
      setError(decideError.message || 'The answer could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close" />
      <section className="drawer drawer--compact" role="dialog" aria-modal="true" aria-labelledby="decision-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{quotation.reference}</p>
            <h2 className="drawer__title" id="decision-title">What did the customer say?</h2>
            <p className="drawer__subtitle">
              {quotation.customer?.name} · {quotation.packageName} · {formatMoney(quotation.amount, quotation.currency)}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="drawer__form">
          <label className="field field--full">
            <span className="field__label">Note <i>Optional</i></span>
            <textarea
              className="input input--area"
              rows={3}
              maxLength={500}
              placeholder="Anything the customer asked for"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={() => decide('rejected')} disabled={saving}>
              Mark rejected
            </button>
            <button type="button" className="btn btn--primary" onClick={() => decide('accepted')} disabled={saving}>
              {saving ? 'Saving…' : 'Mark accepted'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

export default function QuotationsPage({ customerLink }) {
  useDocumentTitle('Quotations');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null, notice: null });
  const [drawer, setDrawer] = useState({ open: false, quotation: null });
  const [decision, setDecision] = useState({ open: false, quotation: null });
  const [busyId, setBusyId] = useState(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 320);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading', error: null }));

    try {
      const payload = await fetchQuotations({ q: debounced, status }, { signal: controller.signal });
      // Keep the last confirmation on screen while the list refreshes.
      setState((previous) => ({
        status: 'ready',
        rows: payload.data ?? [],
        meta: payload.meta ?? null,
        error: null,
        notice: previous.notice,
      }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debounced, status]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  async function act(id, action, successMessage) {
    setBusyId(id);
    setState((previous) => ({ ...previous, error: null, notice: null }));
    try {
      await action();
      await load();
      setState((previous) => ({ ...previous, notice: successMessage }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message }));
    } finally {
      setBusyId(null);
    }
  }

  const rows = state.rows;
  const loading = state.status === 'loading';

  return (
    <div className="quote-page">
      <div className="quote-toolbar">
        <input
          className="quote-toolbar__search"
          aria-label="Search quotations"
          placeholder="Search reference, customer or registration"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="quote-toolbar__filters" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || 'all'}
              type="button"
              className={`quote-filter${status === filter.value ? ' is-active' : ''}`}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary btn--small quote-new" onClick={() => setDrawer({ open: true, quotation: null })}>
          New quotation
        </button>
      </div>

      {state.notice ? <p className="form-notice" role="status">{state.notice}</p> : null}
      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {loading ? <p className="data-state" role="status">Loading quotations…</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>{debounced || status ? 'No quotations match this view' : 'No quotations yet'}</h2>
          <p>
            {debounced || status
              ? 'Try another search term or status.'
              : 'Quotations appear here when one is written for a customer. Nothing is listed until then.'}
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="quote-table-wrap">
          <table className="ledger ledger--stack quote-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Customer</th>
                <th scope="col">Package</th>
                <th scope="col" className="quote-num">Quoted</th>
                <th scope="col">Valid until</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td data-label="Reference">
                      <strong>{row.reference}</strong>
                      {row.version > 1 ? <span className="quote-version">v{row.version}</span> : null}
                      {row.vehicle?.registration ? <span className="ledger__sub">{row.vehicle.registration}</span> : null}
                    </td>
                    <td data-label="Customer">
                      {customerLink ? <Link className="table-link" to={customerLink(row.customer.id)}>{row.customer.name}</Link> : row.customer.name}
                      {row.customer.phone ? <span className="ledger__sub">{row.customer.phone}</span> : null}
                    </td>
                    <td data-label="Package">
                      {row.packageName}
                      {row.discount > 0 ? <span className="ledger__sub">{formatMoney(row.discount, row.currency)} below rate</span> : null}
                    </td>
                    <td data-label="Quoted" className="quote-num">{formatMoney(row.amount, row.currency)}</td>
                    <td data-label="Valid until">{formatDay(row.validUntil)}</td>
                    <td data-label="Status"><span className="quote-status" data-tone={TONE[row.effectiveStatus]}>{row.statusLabel}</span></td>
                    <td data-label="Actions">
                      <div className="quote-actions">
                        {row.effectiveStatus === 'draft' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--outline btn--small"
                              onClick={() => setDrawer({ open: true, quotation: row })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary btn--small"
                              disabled={busy}
                              onClick={() => act(row.id, () => sendQuotation(row.id), `${row.reference} sent.`)}
                            >
                              {busy ? 'Sending…' : 'Send'}
                            </button>
                          </>
                        ) : null}

                        {row.effectiveStatus === 'sent' ? (
                          <button type="button" className="btn btn--outline btn--small" onClick={() => setDecision({ open: true, quotation: row })}>
                            Record answer
                          </button>
                        ) : null}

                        {['rejected', 'expired'].includes(row.effectiveStatus) ? (
                          <button
                            type="button"
                            className="btn btn--outline btn--small"
                            disabled={busy}
                            onClick={() => act(row.id, () => reviseQuotation(row.id, {}), `${row.reference} revised as version ${row.version + 1}.`)}
                          >
                            {busy ? 'Revising…' : 'Revise'}
                          </button>
                        ) : null}

                        <Link className="btn btn--link btn--small" to={`/quotations/${row.id}/print`}>Print</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.meta && state.meta.total > rows.length ? (
        <p className="quote-foot">Showing the {rows.length} most recent of {state.meta.total} quotations.</p>
      ) : null}

      <QuotationDrawer
        open={drawer.open}
        quotation={drawer.quotation}
        onClose={() => setDrawer({ open: false, quotation: null })}
        onSaved={(quotation) => {
          load();
          setState((previous) => ({ ...previous, notice: `${quotation.reference} saved as a draft.` }));
        }}
      />

      <DecisionDialog
        quotation={decision.quotation}
        open={decision.open}
        onClose={() => setDecision({ open: false, quotation: null })}
        onDone={(answer) => {
          load();
          setState((previous) => ({
            ...previous,
            notice: `${decision.quotation?.reference ?? 'The quotation'} marked ${answer}.`,
          }));
        }}
      />
    </div>
  );
}
