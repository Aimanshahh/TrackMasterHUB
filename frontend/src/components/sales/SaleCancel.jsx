import { useState } from 'react';

import { restoreSale, cancelSale } from '../../lib/api.js';
import { CANCEL_REASONS } from './salesHelpers.js';

/**
 * Cancel a sale with a reason, or restore it. A cancelled sale leaves the active counts and
 * keeps its reason; restoring puts it back where it was.
 */
export default function SaleCancel({ row, onChanged }) {
  const held = Boolean(row.cancellation);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      setOpen(false);
      setReason('');
      setNote('');
      onChanged?.();
    } catch (err) {
      setError(err.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (held) {
    return (
      <div className="sm-hold">
        <button type="button" className="sm-btn sm-btn--chat" disabled={busy} onClick={() => run(() => restoreSale(row.id))}>{busy ? 'Restoring…' : 'Restore sale'}</button>
        {error ? <p className="sm-hold__error" role="alert">{error}</p> : null}
      </div>
    );
  }

  if (row.status === 'completed') return null;

  if (!open) {
    return <div className="sm-hold"><button type="button" className="sm-btn" onClick={() => setOpen(true)}>Cancel sale</button></div>;
  }

  return (
    <form className="sm-hold sm-hold__form" onSubmit={(event) => { event.preventDefault(); run(() => cancelSale(row.id, { reason, note })); }}>
      <label className="field">
        <span className="field__label">Why was it cancelled?</span>
        <select className="input" required value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Choose a reason</option>
          {CANCEL_REASONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Note (optional)</span>
        <input className="input" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. will pay on Friday" />
      </label>
      {error ? <p className="sm-hold__error" role="alert">{error}</p> : null}
      <div className="sm-actions">
        <button type="submit" className="sm-btn sm-btn--call" disabled={busy || !reason}>{busy ? 'Saving…' : 'Confirm cancel'}</button>
        <button type="button" className="sm-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
