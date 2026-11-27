import { useEffect, useState } from 'react';

import { createQuotation, updateQuotation } from '../../lib/api.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { usePackages } from '../../hooks/usePackages.js';
import { formatMoney } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Seven days is long enough for a customer to decide without the price drifting. */
const sevenDaysAhead = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const emptyForm = {
  packageKey: '',
  amount: '',
  validUntil: sevenDaysAhead(),
  vehicleRegistration: '',
  terms: '',
  notes: '',
};

function CustomerPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const found = useCustomers({ search, limit: 6 });
  const ready = search.trim().length >= 2;

  if (value) {
    return (
      <div className="quote-picked">
        <div>
          <strong>{value.name}</strong>
          <span>{value.phone || 'No phone on record'}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="quote-picker">
      <label className="field">
        <span className="field__label">Customer <i>Required</i></span>
        <input
          className="input"
          placeholder="Search by name or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
        />
      </label>

      {!ready ? <p className="field__hint">Type at least two characters to search the customer list.</p> : null}
      {ready && found.status === 'loading' ? <p className="field__hint">Searching…</p> : null}
      {ready && found.status !== 'loading' && found.rows.length === 0 ? (
        <p className="field__hint">No customer matches “{search.trim()}”.</p>
      ) : null}

      {ready && found.rows.length > 0 ? (
        <ul className="quote-picker__results">
          {found.rows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => onChange(row)}>
                <strong>{row.name}</strong>
                <span>{[row.phone, row.company].filter(Boolean).join(' · ') || 'No contact details'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Write or edit a quotation. A draft is the only editable state; once it is sent
 * the price is fixed and a change becomes a new version, so the drawer never
 * rewrites a figure the customer has already seen.
 */
export default function QuotationDrawer({ open, onClose, onSaved, customer = null, quotation = null, job = null }) {
  const packages = usePackages();
  const editing = Boolean(quotation);
  const [chosenCustomer, setChosenCustomer] = useState(customer);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setChosenCustomer(customer);
    setForm({
      packageKey: quotation?.packageKey ?? '',
      amount: quotation?.amount ?? '',
      validUntil: quotation?.validUntil ? quotation.validUntil.slice(0, 10) : sevenDaysAhead(),
      vehicleRegistration: quotation?.vehicle?.registration ?? '',
      terms: quotation?.terms ?? '',
      notes: quotation?.notes ?? '',
    });
    setError(null);

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, customer, quotation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const pkg = packages.rows.find((row) => row.key === form.packageKey) ?? null;
  const amount = Number(form.amount);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const belowRate = Boolean(pkg && pkg.price !== null && hasAmount && amount < pkg.price);
  const floor = pkg && Number.isFinite(pkg.minPrice) ? pkg.minPrice : null;
  const belowFloor = Boolean(floor !== null && hasAmount && amount < floor);

  function choosePackage(key) {
    const next = packages.rows.find((row) => row.key === key) ?? null;
    setForm((current) => ({
      ...current,
      packageKey: key,
      // The package rate is the starting point; the salesperson may change it.
      amount: next?.price ?? current.amount,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);

    if (!chosenCustomer && !editing) return setError('Choose the customer this quotation is for.');
    if (!pkg) return setError('Choose the package the customer is being quoted.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter the price you are quoting as a number greater than zero.');
    if (form.validUntil && form.validUntil < today()) return setError('The validity date cannot be in the past.');

    setSaving(true);
    try {
      const payload = {
        packageKey: form.packageKey,
        amount,
        validUntil: form.validUntil,
        vehicleRegistration: form.vehicleRegistration,
        terms: form.terms,
        notes: form.notes,
      };

      const response = editing
        ? await updateQuotation(quotation.id, payload)
        : await createQuotation({ ...payload, customerId: chosenCustomer.id, jobId: job?.id });

      onSaved?.(response.data.quotation);
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'The quotation could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close quotation form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="quotation-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{editing ? 'Quotation draft' : 'New quotation'}</p>
            <h2 className="drawer__title" id="quotation-title">{editing ? 'Adjust the offer' : 'Price an offer'}</h2>
            <p className="drawer__subtitle">
              {editing
                ? 'Only a draft can be changed. Sending fixes these figures for the customer.'
                : 'The package rate is a starting point, not a cap. Anything you agree can be quoted.'}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          {editing ? (
            <div className="quote-picked">
              <div>
                <strong>{quotation.customer?.name}</strong>
                <span>{quotation.customer?.phone || 'No phone on record'}</span>
              </div>
            </div>
          ) : (
            <CustomerPicker value={chosenCustomer} onChange={setChosenCustomer} />
          )}

          <div className="drawer__section-label">Package and price</div>

          {packages.status === 'error' ? (
            <p className="form-alert" role="alert">Package rates could not be loaded: {packages.error}</p>
          ) : null}

          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">Package <i>Required</i></span>
              <select className="input" value={form.packageKey} onChange={(event) => choosePackage(event.target.value)} required>
                <option value="">Choose a package</option>
                {packages.rows.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.name}{row.price === null ? ' — no rate set' : ` — ${formatMoney(row.price)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Quoted price <i>Required</i></span>
              <div className="money-input">
                <em aria-hidden="true">PKR</em>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={update('amount')}
                  required
                />
              </div>
            </label>
            <label className="field">
              <span className="field__label">Valid until <i>Required</i></span>
              <input className="input" type="date" min={today()} value={form.validUntil} onChange={update('validUntil')} required />
            </label>

            <label className="field field--full">
              <span className="field__label">Vehicle registration <i>Optional</i></span>
              <input
                className="input"
                maxLength={60}
                placeholder="ABC-123"
                value={form.vehicleRegistration}
                onChange={update('vehicleRegistration')}
              />
            </label>
          </div>

          {pkg && pkg.price === null ? (
            <p className="form-alert" role="alert">
              The {pkg.name} package has no rate set. Ask the admin to price it before quoting it.
            </p>
          ) : null}

          {belowFloor ? (
            <p className="quote-hint quote-hint--floor">
              Under the {pkg.name} lowest price of {formatMoney(floor)}. The quote can be printed, but a sale
              at this price needs the admin's approval.
            </p>
          ) : null}

          {belowRate && !belowFloor ? (
            <p className="quote-hint">
              {formatMoney(pkg.price - amount)} below the {pkg.name} standard rate of {formatMoney(pkg.price)}
              {floor !== null ? ` — within your limit (lowest ${formatMoney(floor)}), no approval needed` : '; a sale at this price needs the admin\'s approval'}.
            </p>
          ) : null}

          <div className="drawer__section-label">Terms</div>
          <label className="field field--full">
            <span className="field__label">Terms shown on the printed quotation</span>
            <textarea
              className="input input--area"
              rows={4}
              maxLength={1000}
              placeholder="Leave empty to use the standard terms."
              value={form.terms}
              onChange={update('terms')}
            />
          </label>
          <label className="field field--full">
            <span className="field__label">Internal note <i>Optional</i></span>
            <input
              className="input"
              maxLength={1000}
              placeholder="Not printed — why this price, what the customer asked for"
              value={form.notes}
              onChange={update('notes')}
            />
          </label>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save draft' : 'Create draft'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
