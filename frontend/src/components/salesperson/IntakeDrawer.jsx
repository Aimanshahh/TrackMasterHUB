import { useEffect, useState } from 'react';

import { createCustomer, createJobRecord } from '../../lib/api.js';
import { PRIORITY_OPTIONS } from '../../app/operations.js';
import { usePackages } from '../../hooks/usePackages.js';
import { formatMoney } from '../../lib/format.js';

const emptyForm = {
  requestType: 'new_installation',
  name: '',
  phone: '',
  email: '',
  company: '',
  category: '',
  priority: 'normal',
  followUp: '',
  notes: '',
  vehicleLabel: '',
  vehicleRegistration: '',
  station: '',
  installDate: '',
  installTime: '',
  packageKey: '',
  quotedPrice: '',
  approvalReason: '',
};

/**
 * Salesperson intake. One form captures the customer and, for a new
 * installation, pushes the vehicle request straight into the operations queue.
 * The owner is assigned by the backend from the session, never from this form.
 */
export default function IntakeDrawer({ open, onClose, onSaved }) {
  const packages = usePackages();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError(null);
      setNotice(null);
    }
  }, [open]);

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const isInstallation = form.requestType === 'new_installation';

  const selectedPackage = packages.rows.find((pkg) => pkg.key === form.packageKey) ?? null;
  const quoteNumber = Number(form.quotedPrice);
  const hasQuote = form.quotedPrice !== '' && Number.isFinite(quoteNumber) && quoteNumber > 0;
  const quoteState = !selectedPackage || selectedPackage.price === null || !hasQuote
    ? null
    : quoteNumber > selectedPackage.price
      ? 'over'
      : quoteNumber < selectedPackage.price
        ? 'below'
        : 'exact';

  function choosePackage(pkg) {
    setForm((current) => ({ ...current, packageKey: pkg.key, quotedPrice: pkg.price ?? '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // A slot needs both halves; half a slot would be stored as an unclear time.
    if (isInstallation && Boolean(form.installDate) !== Boolean(form.installTime)) {
      setError('Add both the installation date and the installation time, or leave both empty.');
      return;
    }

    // The package rate comes from the admin, so a quote can never be invented.
    if (isInstallation) {
      if (!selectedPackage) {
        setError('Choose the package the customer is buying.');
        return;
      }
      if (selectedPackage.price === null) {
        setError(`The ${selectedPackage.name} package has no rate yet. Ask the admin to set package pricing first.`);
        return;
      }
      if (!hasQuote) {
        setError('Enter the price you quoted the customer.');
        return;
      }
      if (quoteNumber > selectedPackage.price) {
        setError(`A quote cannot be above the ${selectedPackage.name} package rate of ${formatMoney(selectedPackage.price)}.`);
        return;
      }
    }

    setSaving(true);
    const scheduledAt = isInstallation && form.installDate && form.installTime
      ? new Date(`${form.installDate}T${form.installTime}`).toISOString()
      : undefined;

    try {
      const payload = await createCustomer({
        name: form.name,
        phone: form.phone,
        email: form.email,
        company: form.company,
        category: form.category,
        priority: form.priority,
        followUp: form.followUp || undefined,
        notes: form.notes,
      });

      const customer = payload.data.customer;

      if (isInstallation) {
        try {
          const jobPayload = await createJobRecord({
            customerId: customer.id,
            requestType: 'new_installation',
            vehicleLabel: form.vehicleLabel,
            vehicleRegistration: form.vehicleRegistration,
            station: form.station,
            scheduledAt,
            priority: form.priority,
            notes: form.notes,
            packageKey: form.packageKey,
            quotedPrice: quoteNumber,
            approvalReason: quoteState === 'below' ? form.approvalReason : undefined,
          });

          setNotice(
            jobPayload.data.job.approvalStatus === 'pending'
              ? 'Customer saved. The installation is in the queue and the discounted price is waiting for the admin.'
              : 'Customer saved and the installation request is now in the operations queue.',
          );
        } catch (jobError) {
          setNotice(null);
          setError(`The customer was saved, but the installation request was not created: ${jobError.message}`);
          onSaved?.(customer);
          setSaving(false);
          return;
        }
      } else {
        setNotice('Customer saved to your portfolio.');
      }

      onSaved?.(customer);
      setForm(emptyForm);
      setSaving(false);
    } catch (saveError) {
      setError(saveError.message || 'The customer could not be saved.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close intake form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="intake-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">New customer</p>
            <h2 className="drawer__title" id="intake-title">Add to your portfolio</h2>
            <p className="drawer__subtitle">You are recorded as the owner. Installations go straight to the operations desk.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <fieldset className="field-choice">
            <legend className="field__label">Request type</legend>
            <div className="segmented" role="radiogroup" aria-label="Request type">
              {[
                { value: 'new_installation', label: 'New installation', hint: 'Vehicle work for operations' },
                { value: 'follow_up', label: 'Follow-up', hint: 'Contact only, no vehicle yet' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={form.requestType === option.value}
                  className={`segmented__option${form.requestType === option.value ? ' is-active' : ''}`}
                  onClick={() => setForm((current) => ({ ...current, requestType: option.value }))}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="drawer__section-label">Customer</div>
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">Customer name <i>Required</i></span>
              <input className="input" required maxLength={200} autoComplete="name" placeholder="Full name" value={form.name} onChange={update('name')} autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Phone <i>Required</i></span>
              <input className="input" type="tel" required maxLength={60} autoComplete="tel" placeholder="Customer’s own number" value={form.phone} onChange={update('phone')} />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input className="input" type="email" maxLength={240} autoComplete="email" placeholder="Optional" value={form.email} onChange={update('email')} />
            </label>
            <label className="field">
              <span className="field__label">Business name</span>
              <input className="input" maxLength={200} placeholder="Optional" value={form.company} onChange={update('company')} />
            </label>
            <label className="field">
              <span className="field__label">Category</span>
              <select className="input" value={form.category} onChange={update('category')}>
                <option value="">Not set</option>
                <option value="Individual">Individual</option>
                <option value="Fleet">Fleet</option>
                <option value="Corporate">Corporate</option>
                <option value="Dealer">Dealer</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          {isInstallation ? (
            <>
              <div className="drawer__section-label">Vehicle &amp; installation</div>
              <div className="field-grid">
                <label className="field">
                  <span className="field__label">Car name / label <i>Required</i></span>
                  <input className="input" required maxLength={120} placeholder="e.g. Corolla GLi" value={form.vehicleLabel} onChange={update('vehicleLabel')} />
                </label>
                <label className="field">
                  <span className="field__label">Registration <i>Required</i></span>
                  <input className="input" required maxLength={60} placeholder="e.g. ABC-1234" value={form.vehicleRegistration} onChange={update('vehicleRegistration')} />
                </label>
                <label className="field field--full">
                  <span className="field__label">Installation station / location <i>Required</i></span>
                  <input className="input" required maxLength={120} placeholder="City or office where the fitting happens" value={form.station} onChange={update('station')} />
                </label>
                <label className="field">
                  <span className="field__label">Installation date</span>
                  <input className="input" type="date" value={form.installDate} onChange={update('installDate')} />
                </label>
                <label className="field">
                  <span className="field__label">Installation time</span>
                  <input className="input" type="time" value={form.installTime} onChange={update('installTime')} />
                </label>
                <p className="field__hint field--full">The slot you ask for here is passed to operations, which confirms it and assigns the technician.</p>
              </div>
            </>
          ) : null}

          {isInstallation ? (
            <>
              <div className="drawer__section-label">Package &amp; price</div>
              {packages.status === 'error' ? (
                <p className="form-alert" role="alert">Package rates could not be loaded: {packages.error}</p>
              ) : null}
              {packages.status === 'loading' ? <p className="field__hint">Loading package rates…</p> : null}

              <div className="pkg-pick" role="radiogroup" aria-label="Service package">
                {packages.rows.map((pkg) => (
                  <button
                    key={pkg.key}
                    type="button"
                    role="radio"
                    aria-checked={form.packageKey === pkg.key}
                    className={`pkg-pick__option${form.packageKey === pkg.key ? ' is-active' : ''}${pkg.configured ? '' : ' is-unpriced'}`}
                    onClick={() => choosePackage(pkg)}
                    disabled={!pkg.configured}
                    title={pkg.configured ? pkg.summary : 'The admin has not set a rate for this package yet.'}
                  >
                    <span className="pkg-pick__name">{pkg.name}</span>
                    <span className="pkg-pick__price">{pkg.configured ? formatMoney(pkg.price) : 'Not priced'}</span>
                  </button>
                ))}
              </div>

              {packages.status === 'ready' && packages.rows.length > 0 && packages.rows.every((pkg) => !pkg.configured) ? (
                <p className="quote-note" data-state="over">
                  No package has a rate yet, so nothing can be quoted. Ask the admin to set package pricing, or save this customer as a follow-up.
                </p>
              ) : null}

              <div className="field-grid">
                <label className="field">
                  <span className="field__label">Price quoted <i>Required</i></span>
                  <div className="money-input">
                    <em aria-hidden="true">PKR</em>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      placeholder={selectedPackage?.price ? String(selectedPackage.price) : 'Package rate'}
                      value={form.quotedPrice}
                      onChange={update('quotedPrice')}
                    />
                  </div>
                </label>
                {quoteState === 'below' ? (
                  <label className="field">
                    <span className="field__label">Why the discount?</span>
                    <input
                      className="input"
                      maxLength={500}
                      placeholder="Goes to the admin with the request"
                      value={form.approvalReason}
                      onChange={update('approvalReason')}
                    />
                  </label>
                ) : null}
              </div>

              {quoteState ? (
                <p className="quote-note" data-state={quoteState}>
                  {quoteState === 'over'
                    ? `Above the ${selectedPackage.name} rate. A quote cannot be higher than the package price.`
                    : null}
                  {quoteState === 'below'
                    ? `Below the ${selectedPackage.name} rate of ${formatMoney(selectedPackage.price)}. This installation waits for the admin to approve the price before operations can complete it.`
                    : null}
                  {quoteState === 'exact'
                    ? `At the ${selectedPackage.name} package rate. No approval needed.`
                    : null}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="drawer__section-label">Planning</div>
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Priority</span>
              <select className="input" value={form.priority} onChange={update('priority')}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Next follow-up</span>
              <input className="input" type="date" value={form.followUp} onChange={update('followUp')} />
            </label>
            <label className="field field--full">
              <span className="field__label">Notes</span>
              <textarea className="input input--area" rows={3} maxLength={2000} placeholder="What was discussed, what the customer asked for…" value={form.notes} onChange={update('notes')} />
            </label>
          </div>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          {notice ? <p className="form-notice" role="status">{notice}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isInstallation ? 'Save & send to operations' : 'Save customer'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
