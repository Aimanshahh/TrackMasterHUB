import { useState } from 'react';

import { ENGINE_KILL_OPTIONS, engineKillLabel, engineKillTone } from '../../app/installation.js';
import { updateEngineKill } from '../../lib/api.js';

export function EngineKillBadge({ status, label }) {
  return <span className="state-tag" data-state={engineKillTone(status)}>{label || engineKillLabel(status)}</span>;
}

/** Change a vehicle's engine kill status without touching its GPS installation. Every change is kept in the history. */
export function EngineKillDrawer({ jobId, current, onClose, onSaved }) {
  const [status, setStatus] = useState(current?.status && current.status !== 'not_set' ? current.status : 'implemented');
  const [reason, setReason] = useState(current?.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = await updateEngineKill(jobId, { status, reason });
      onSaved?.(payload.data.job);
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The engine kill status could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close engine kill" />
      <section className="drawer drawer--compact" role="dialog" aria-modal="true" aria-labelledby="ek-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Engine kill</p>
            <h2 className="drawer__title" id="ek-title">Update engine kill status</h2>
            <p className="drawer__subtitle">Kept separate from the GPS installation. The previous status stays in the history.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close" data-close>×</button>
        </header>
        <form className="drawer__form" onSubmit={submit}>
          <p className="field__hint">Currently: <EngineKillBadge status={current?.status ?? 'not_set'} /></p>
          <fieldset className="inst-choice">
            <legend className="field__label">New status</legend>
            {ENGINE_KILL_OPTIONS.filter((option) => option.value !== 'not_set').map((option) => (
              <label key={option.value} className={`inst-choice__option${status === option.value ? ' is-on' : ''}`}>
                <input type="radio" name="ek-status" value={option.value} checked={status === option.value} onChange={() => setStatus(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span className="field__label">{status === 'not_implemented' ? 'Reason (required)' : 'Note (optional)'}</span>
            <textarea className="input input--area" rows={3} maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={status === 'not_implemented' ? 'Why can the engine not be immobilised on this vehicle?' : 'e.g. relay fitted at service visit'} required={status === 'not_implemented'} />
          </label>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save status'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
