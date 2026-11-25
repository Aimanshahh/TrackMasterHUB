import { useCallback, useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  fetchTechnicianPaymentAccount,
  fetchTechnicianPayments,
  recordTechnicianPayment,
  reverseTechnicianEarning,
  updateTechnicianRates,
} from '../../lib/api.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';

const METHODS = [
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
  ['easypaisa', 'Easypaisa'],
  ['jazzcash', 'JazzCash'],
  ['cheque', 'Cheque'],
  ['other', 'Other'],
];

export default function TechnicianPaymentsPage() {
  useDocumentTitle('Technician payments');
  const [accounts, setAccounts] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const [selectedId, setSelectedId] = useState(null);
  const [account, setAccount] = useState({ status: 'idle', data: null, error: null });
  const [payment, setPayment] = useState({ amount: '', paidAt: '', method: 'cash', referenceNumber: '', remarks: '' });
  const [rates, setRates] = useState({ normal: '', redo: '', additional: '', remarks: '' });
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);

  const loadAccounts = useCallback(async (signal) => {
    try {
      const payload = await fetchTechnicianPayments({ signal });
      setAccounts({ status: 'ready', rows: payload.data ?? [], meta: payload.meta ?? null, error: null });
      setSelectedId((current) => current ?? payload.data?.[0]?.technician?.id ?? null);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setAccounts((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts]);

  const loadAccount = useCallback(async (id, signal) => {
    if (!id) return;
    setAccount((previous) => ({ ...previous, status: previous.data?.technician?.id === id ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchTechnicianPaymentAccount(id, { signal });
      setAccount({ status: 'ready', data: payload.data, error: null });
      setRates({
        normal: payload.data.technician?.rates?.normal ?? '',
        redo: payload.data.technician?.rates?.redo ?? '',
        additional: payload.data.technician?.rates?.additional ?? '',
        remarks: payload.data.technician?.rates?.remarks ?? '',
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setAccount((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAccount(selectedId, controller.signal);
    return () => controller.abort();
  }, [selectedId, loadAccount]);

  async function submitPayment(event) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy('payment');
    setFeedback(null);
    try {
      await recordTechnicianPayment(selectedId, {
        amount: payment.amount,
        paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : undefined,
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        remarks: payment.remarks,
      });
      setPayment({ amount: '', paidAt: '', method: 'cash', referenceNumber: '', remarks: '' });
      await Promise.all([loadAccounts(), loadAccount(selectedId)]);
      setFeedback({ tone: 'ok', text: 'Payment recorded. The balance was recalculated from the ledger.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function saveRates(event) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy('rates');
    setFeedback(null);
    try {
      await updateTechnicianRates(selectedId, {
        normal: rates.normal === '' ? null : rates.normal,
        redo: rates.redo === '' ? null : rates.redo,
        additional: rates.additional === '' ? 0 : rates.additional,
        remarks: rates.remarks,
      });
      await Promise.all([loadAccounts(), loadAccount(selectedId)]);
      setFeedback({ tone: 'ok', text: 'Rates saved. Installations approved from now on use the new rate.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function reverse(id) {
    const note = window.prompt('Why is this earning being reversed? It stays on record with this note.');
    if (!note) return;
    setBusy(`reverse-${id}`);
    setFeedback(null);
    try {
      await reverseTechnicianEarning(id, { note });
      await Promise.all([loadAccounts(), loadAccount(selectedId)]);
      setFeedback({ tone: 'ok', text: 'Earning reversed and kept in the ledger.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  const data = account.data;

  return (
    <div className="field-page">
      <div className="field-strip">
        <div><span>Technicians</span><strong>{accounts.meta?.technicians ?? 0}</strong></div>
        <div><span>Total earned</span><strong>{formatMoney(accounts.meta?.earned ?? 0)}</strong></div>
        <div><span>Paid</span><strong>{formatMoney(accounts.meta?.paid ?? 0)}</strong></div>
        <div><span>Outstanding</span><strong>{formatMoney(accounts.meta?.outstanding ?? 0)}</strong></div>
      </div>

      {accounts.error ? <div className="field-alert" role="alert"><p>{accounts.error}</p></div> : null}

      {feedback ? (
        <div className={`field-message field-message--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      ) : null}

      <div className="field-split">
        <ul className="field-list">
          {accounts.rows.map((row) => (
            <li key={row.technician.id}>
              <button
                type="button"
                className={`field-list__item${selectedId === row.technician.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(row.technician.id)}
              >
                <span className="field-list__name">{row.technician.name}</span>
                <span className="field-list__meta">
                  {row.technician.station || 'No station'} · {row.totals.installations} installation{row.totals.installations === 1 ? '' : 's'}
                </span>
                <span className={`field-list__money${row.totals.balance > 0 ? ' is-due' : ''}`}>{formatMoney(row.totals.balance)}</span>
                {!row.technician.active ? <span className="field-chip field-chip--plain">Inactive</span> : null}
              </button>
            </li>
          ))}
          {!accounts.rows.length && accounts.status === 'ready' ? (
            <li><p className="data-state">No technician records exist yet. Operations creates technicians; the admin sets their rates here.</p></li>
          ) : null}
        </ul>

        {data ? (
          <section className="field-detail">
            <header className="field-detail__head">
              <div>
                <p className="field-detail__ref">Technician account</p>
                <h2>{data.technician.name}</h2>
                <p className="field-detail__meta">{data.technician.station || 'No station'} · {data.technician.phone || 'No phone'}</p>
              </div>
              <span className="field-detail__package">{formatMoney(data.totals?.balance ?? 0)} due</span>
            </header>

            <dl className="field-facts">
              <div><dt>Completed installations</dt><dd>{data.totals?.installations ?? 0}</dd></div>
              <div><dt>Normal earnings</dt><dd>{formatMoney(data.totals?.normalAmount ?? 0)}</dd></div>
              <div><dt>Redo earnings</dt><dd>{formatMoney(data.totals?.redoAmount ?? 0)}</dd></div>
              <div><dt>Total earned</dt><dd>{formatMoney(data.totals?.earned ?? 0)}</dd></div>
              <div><dt>Total paid</dt><dd>{formatMoney(data.totals?.paid ?? 0)}</dd></div>
              <div><dt>Remaining balance</dt><dd>{formatMoney(data.totals?.balance ?? 0)}</dd></div>
            </dl>

            <form className="field-form" onSubmit={saveRates}>
              <h3>Installation rates</h3>
              <div className="field-row">
                <label className="field-field"><span>Normal</span><input type="number" min="0" value={rates.normal} onChange={(event) => setRates((p) => ({ ...p, normal: event.target.value }))} placeholder="e.g. 2000" /></label>
                <label className="field-field"><span>Redo</span><input type="number" min="0" value={rates.redo} onChange={(event) => setRates((p) => ({ ...p, redo: event.target.value }))} placeholder="e.g. 1500" /></label>
                <label className="field-field"><span>Additional</span><input type="number" min="0" value={rates.additional} onChange={(event) => setRates((p) => ({ ...p, additional: event.target.value }))} placeholder="0" /></label>
              </div>
              <label className="field-field"><span>Rate remarks</span><input type="text" value={rates.remarks} onChange={(event) => setRates((p) => ({ ...p, remarks: event.target.value }))} placeholder="Optional" /></label>
              <button type="submit" className="btn btn--outline btn--small" disabled={busy === 'rates'}>{busy === 'rates' ? 'Saving…' : 'Save rates'}</button>
            </form>

            <form className="field-form" onSubmit={submitPayment}>
              <h3>Record a payment</h3>
              <div className="field-row">
                <label className="field-field"><span>Amount</span><input type="number" min="1" value={payment.amount} onChange={(event) => setPayment((p) => ({ ...p, amount: event.target.value }))} required /></label>
                <label className="field-field"><span>Date</span><input type="date" value={payment.paidAt} onChange={(event) => setPayment((p) => ({ ...p, paidAt: event.target.value }))} /></label>
                <label className="field-field">
                  <span>Method</span>
                  <select value={payment.method} onChange={(event) => setPayment((p) => ({ ...p, method: event.target.value }))}>
                    {METHODS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label className="field-field"><span>Reference</span><input type="text" value={payment.referenceNumber} onChange={(event) => setPayment((p) => ({ ...p, referenceNumber: event.target.value }))} placeholder="Cheque or transaction id" /></label>
                <label className="field-field"><span>Remarks</span><input type="text" value={payment.remarks} onChange={(event) => setPayment((p) => ({ ...p, remarks: event.target.value }))} placeholder="Optional" /></label>
              </div>
              <button type="submit" className="btn btn--primary btn--small" disabled={busy === 'payment'}>{busy === 'payment' ? 'Recording…' : 'Record payment'}</button>
            </form>

            <section>
              <h3>Earnings</h3>
              {data.earnings.length ? (
                <div className="field-table-wrap">
                  <table className="field-table">
                    <thead><tr><th>Installation</th><th>Type</th><th>Rate</th><th>Amount</th><th>Approved</th><th /></tr></thead>
                    <tbody>
                      {data.earnings.map((row) => (
                        <tr key={row.id}>
                          <td>{row.customerName || row.reference}<span className="field-table__muted"> · {row.vehicleRegistration || '—'}</span></td>
                          <td>{row.typeLabel}</td>
                          <td>{formatMoney(row.rate)}</td>
                          <td><strong className={row.reversed ? 'field-table__muted' : ''}>{formatMoney(row.amount)}</strong></td>
                          <td className="field-table__muted">{formatDateTime(row.earnedAt)}</td>
                          <td>
                            {row.reversed ? <span className="field-chip field-chip--plain">Reversed</span> : (
                              <button type="button" className="field-link-button" disabled={busy === `reverse-${row.id}`} onClick={() => reverse(row.id)}>Reverse</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="field-note">No approved installation has created an earning for this technician yet.</p>}
            </section>

            <section>
              <h3>Payments</h3>
              {data.payments.length ? (
                <div className="field-table-wrap">
                  <table className="field-table">
                    <thead><tr><th>Reference</th><th>Amount</th><th>Method</th><th>Date</th><th>Recorded by</th></tr></thead>
                    <tbody>
                      {data.payments.map((row) => (
                        <tr key={row.id}>
                          <td>{row.reference}{row.referenceNumber ? <span className="field-table__muted"> · {row.referenceNumber}</span> : null}</td>
                          <td><strong>{formatMoney(row.amount)}</strong></td>
                          <td>{row.methodLabel}</td>
                          <td className="field-table__muted">{formatDateTime(row.paidAt)}</td>
                          <td className="field-table__muted">{row.recordedByName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="field-note">No payment has been recorded for this technician yet.</p>}
            </section>
          </section>
        ) : (
          <p className="data-state">{account.status === 'loading' ? 'Loading the ledger…' : 'Select a technician to open their ledger.'}</p>
        )}
      </div>
    </div>
  );
}
