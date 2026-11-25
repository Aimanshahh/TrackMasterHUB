import { useState } from 'react';

import { resumeSale, suspendSale } from '../../lib/api.js';
import { HOLD_REASONS } from './salesHelpers.js';

/**
 * Put a sale on hold, or take it off hold. A held sale is not lost: it stays
 * where it was and leaves the active counts until it is resumed.
 */
export default function SaleHold({ row, onChanged }) {
  const held = Boolean(row.suspension);
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
        <button type="button" className="sm-btn sm-btn--chat" disabled={busy} onClick={() => run(() => resumeSale(row.id))}>{busy ? 'Resuming…' : 'Resume sale'}</button>
        {error ? <p className="sm-hold__error" role="alert">{error}</p> : null}
      </div>
    );
  }

  if (['completed', 'cancelled'].includes(row.status)) return null;

  if (!open) {
    return <div className="sm-hold"><button type="button" className="sm-btn" onClick={() => setOpen(true)}>Put on hold</button></div>;
  }

  return (
    <form className="sm-hold sm-hold__form" onSubmit={(event) => { event.preventDefault(); run(() => suspendSale(row.id, { reason, note })); }}>
      <label className="field">
        <span className="field__label">Why is it on hold?</span>
        <select className="input" required value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Choose a reason</option>
          {HOLD_REASONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Note (optional)</span>
        <input className="input" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. will pay on Friday" />
      </label>
      {error ? <p className="sm-hold__error" role="alert">{error}</p> : null}
      <div className="sm-actions">
        <button type="submit" className="sm-btn sm-btn--call" disabled={busy || !reason}>{busy ? 'Saving…' : 'Hold sale'}</button>
        <button type="button" className="sm-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
