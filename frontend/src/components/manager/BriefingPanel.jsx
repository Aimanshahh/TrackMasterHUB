import { useState } from 'react';

const emptyBriefing = {
  cnic: '',
  dob: '',
  ePin: '',
  secondaryPhone: '',
  secondaryRelation: '',
  geofenceAddress: '',
};

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/** Stored as digits; shown the way a CNIC is written. */
function formatCnic(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 13) return value || '—';
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function AccountStateTag({ customer, installations }) {
  if (!installations) return <span className="state-tag" data-state="muted">Not installed</span>;
  if (customer?.briefingCompleted) return <span className="state-tag" data-state="paid">Active</span>;
  return <span className="state-tag" data-state="overdue">Briefing pending</span>;
}

/**
 * The installation completes in the field, but the account only becomes active
 * here. These fields are the manager's authority, so the panel states plainly
 * who may read them and what saving does.
 */
export default function BriefingPanel({ customer, saving, onSave }) {
  const completed = Boolean(customer?.briefingCompleted);
  const [editing, setEditing] = useState(!completed);
  const [form, setForm] = useState({
    ...emptyBriefing,
    cnic: customer?.briefing?.cnic ?? '',
    dob: customer?.briefing?.dob ? String(customer.briefing.dob).slice(0, 10) : '',
    ePin: customer?.briefing?.ePin ?? '',
    secondaryPhone: customer?.briefing?.secondaryPhone ?? '',
    secondaryRelation: customer?.briefing?.secondaryRelation ?? '',
    geofenceAddress: customer?.briefing?.geofenceAddress ?? '',
  });
  const [error, setError] = useState(null);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError(null);
    try {
      await onSave(form);
      setEditing(false);
    } catch (error_) {
      setError(error_.message || 'The briefing could not be saved.');
    }
  }

  return (
    <section className="panel brief-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Security briefing</h2>
          <p className="panel__meta">
            {completed
              ? `Completed ${formatDay(customer.briefing?.completedAt)} · account active`
              : 'Required before this account is activated'}
          </p>
        </div>
        {completed && !editing ? (
          <button type="button" className="btn btn--outline btn--small" onClick={() => setEditing(true)}>Update briefing</button>
        ) : null}
      </div>

      {!completed ? (
        <p className="brief-gate">
          <span aria-hidden="true">!</span>
          A finished installation does not activate an account. Record these details to activate it; the customer stays
          inactive until you do.
        </p>
      ) : null}

      {!editing && completed ? (
        <dl className="brief-readout">
          <div><dt>CNIC</dt><dd>{formatCnic(customer.briefing?.cnic)}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatDay(customer.briefing?.dob)}</dd></div>
          <div><dt>E-PIN</dt><dd className="brief-readout__secret">{customer.briefing?.ePin || '—'}</dd></div>
          <div><dt>Secondary user</dt><dd>{customer.briefing?.secondaryPhone || '—'} <small>{customer.briefing?.secondaryRelation}</small></dd></div>
          <div className="brief-readout__wide"><dt>Vehicle station / geofence</dt><dd>{customer.briefing?.geofenceAddress || '—'}</dd></div>
        </dl>
      ) : null}

      {editing ? (
        <form className="brief-form" onSubmit={submit}>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">CNIC <i>13 digits</i></span>
              <input className="input" inputMode="numeric" maxLength={20} placeholder="37405-1234567-1" value={form.cnic} onChange={update('cnic')} required />
            </label>
            <label className="field">
              <span className="field__label">Date of birth</span>
              <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={update('dob')} required />
            </label>
            <label className="field">
              <span className="field__label">E-PIN <i>4–8 digits</i></span>
              <input className="input" inputMode="numeric" maxLength={12} value={form.ePin} onChange={update('ePin')} required />
            </label>
            <label className="field">
              <span className="field__label">Secondary user phone</span>
              <input className="input" type="tel" maxLength={60} placeholder="Who else can operate the vehicle" value={form.secondaryPhone} onChange={update('secondaryPhone')} required />
            </label>
            <label className="field">
              <span className="field__label">Secondary user relationship</span>
              <input className="input" maxLength={80} placeholder="e.g. Spouse, Driver" value={form.secondaryRelation} onChange={update('secondaryRelation')} required />
            </label>
            <label className="field field--full">
              <span className="field__label">Vehicle station / geofence address</span>
              <input className="input" maxLength={400} placeholder="Where the vehicle normally stays" value={form.geofenceAddress} onChange={update('geofenceAddress')} required />
            </label>
          </div>

          <p className="field__hint">
            CNIC, date of birth, E-PIN and secondary-user details are restricted to the manager and admin. They are never
            shown to the salesperson, in notifications or in exports.
          </p>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <div className="brief-form__foot">
            {completed ? (
              <button type="button" className="btn btn--outline btn--small" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            ) : null}
            <button type="submit" className="btn btn--primary btn--small" disabled={saving}>
              {saving ? 'Saving…' : completed ? 'Update briefing' : 'Save briefing & activate account'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
