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
  installDate: '',
  installTime: '',
};

let vehicleCounter = 0;

/** One vehicle row. Each vehicle carries its own package, price and approval reason. */
function newVehicle() {
  vehicleCounter += 1;
  return {
    id: `vehicle-${vehicleCounter}`,
    vehicleLabel: '',
    vehicleRegistration: '',
    station: '',
    packageKey: '',
    quotedPrice: '',
    packageFeatures: '',
    deviceOwnership: 'company',
    approvalReason: '',
  };
}

/** Where a quote sits against the package's minimum selling price. */
function quoteStateFor(vehicle, packageRows) {
  const pkg = packageRows.find((row) => row.key === vehicle.packageKey) ?? null;
  const quote = Number(vehicle.quotedPrice);
  const hasQuote = vehicle.quotedPrice !== '' && Number.isFinite(quote) && quote > 0;
  const state = !pkg || pkg.price === null || !hasQuote
    ? null
    : quote < pkg.price
      ? 'below'
      : quote > pkg.price
        ? 'above'
        : 'exact';
  return { pkg, quote, hasQuote, state };
}

/**
 * Salesperson intake. One form captures the customer and, for a new
 * installation, pushes the vehicle request straight into the operations queue.
 * The owner is assigned by the backend from the session, never from this form.
 */
export default function IntakeDrawer({ open, onClose, onSaved }) {
  const packages = usePackages();
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState(() => [newVehicle()]);
  const [savedCustomer, setSavedCustomer] = useState(null);
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
      setVehicles([newVehicle()]);
      setSavedCustomer(null);
      setError(null);
      setNotice(null);
    }
  }, [open]);

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const isInstallation = form.requestType === 'new_installation';

  const updateVehicle = (id, key) => (event) => {
    const { value } = event.target;
    setVehicles((current) => current.map((vehicle) => (vehicle.id === id ? { ...vehicle, [key]: value } : vehicle)));
  };

  function choosePackage(id, pkg) {
    setVehicles((current) => current.map((vehicle) => (
      vehicle.id === id ? { ...vehicle, packageKey: pkg.key, quotedPrice: pkg.price ?? '' } : vehicle
    )));
  }

  const addVehicle = () => setVehicles((current) => [...current, newVehicle()]);
  const removeVehicle = (id) => setVehicles((current) => (current.length > 1 ? current.filter((vehicle) => vehicle.id !== id) : current));

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // A slot needs both halves; half a slot would be stored as an unclear time.
    if (isInstallation && Boolean(form.installDate) !== Boolean(form.installTime)) {
      setError('Add both the installation date and the installation time, or leave both empty.');
      return;
    }

    // The package rate is the admin's minimum, so a quote can never be invented.
    if (isInstallation) {
      for (let index = 0; index < vehicles.length; index += 1) {
        const vehicle = vehicles[index];
        const { pkg, hasQuote } = quoteStateFor(vehicle, packages.rows);
        const label = vehicles.length > 1 ? `Vehicle ${index + 1}: ` : '';

        if (!pkg) {
          setError(`${label}Choose the package the customer is buying.`);
          return;
        }
        if (pkg.price === null) {
          setError(`${label}The ${pkg.name} package has no rate yet. Ask the admin to set package pricing first.`);
          return;
        }
        if (!hasQuote) {
          setError(`${label}Enter the price you quoted the customer.`);
          return;
        }
      }

      const registrations = vehicles.map((vehicle) => vehicle.vehicleRegistration.trim().toLowerCase());
      if (new Set(registrations).size !== registrations.length) {
        setError('Two vehicles in this form have the same registration. Check the numbers.');
        return;
      }
    }

    setSaving(true);
    const scheduledAt = isInstallation && form.installDate && form.installTime
      ? new Date(`${form.installDate}T${form.installTime}`).toISOString()
      : undefined;

    let customer = savedCustomer;

    try {
      if (!customer) {
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
        customer = payload.data.customer;
        setSavedCustomer(customer);
      }
    } catch (saveError) {
      setError(saveError.message || 'The customer could not be saved.');
      setSaving(false);
      return;
    }

    if (!isInstallation) {
      setNotice('Customer saved to your portfolio.');
      onSaved?.(customer);
      setForm(emptyForm);
      setSavedCustomer(null);
      setSaving(false);
      return;
    }

    // One job per vehicle, all under the same customer. Vehicles that go
    // through leave the form so a retry only resends the ones that failed.
    const failures = [];
    let sent = 0;
    let awaitingApproval = 0;

    for (const vehicle of vehicles) {
      const { quote, state } = quoteStateFor(vehicle, packages.rows);
      try {
        const jobPayload = await createJobRecord({
          customerId: customer.id,
          requestType: 'new_installation',
          vehicleLabel: vehicle.vehicleLabel,
          vehicleRegistration: vehicle.vehicleRegistration,
          station: vehicle.station,
          scheduledAt,
          priority: form.priority,
          notes: form.notes,
          packageKey: vehicle.packageKey,
          quotedPrice: quote,
          packageFeatures: vehicle.packageFeatures.split('\n').map((feature) => feature.trim()).filter(Boolean),
          deviceOwnership: vehicle.deviceOwnership,
          approvalReason: state === 'below' ? vehicle.approvalReason : undefined,
        });
        sent += 1;
        if (jobPayload.data.job.approvalStatus === 'pending') awaitingApproval += 1;
        setVehicles((current) => current.filter((row) => row.id !== vehicle.id));
      } catch (jobError) {
        failures.push({ vehicle, message: jobError.message });
      }
    }

    onSaved?.(customer);

    if (failures.length > 0) {
      const first = failures[0];
      const name = first.vehicle.vehicleRegistration || first.vehicle.vehicleLabel || 'a vehicle';
      setError(
        `The customer was saved${sent ? ` and ${sent} installation${sent === 1 ? '' : 's'} sent` : ''}, but ${failures.length} vehicle${failures.length === 1 ? '' : 's'} could not be submitted (${name}: ${first.message}). Fix ${failures.length === 1 ? 'it' : 'them'} and save again — vehicles already sent will not be duplicated.`,
      );
      setSaving(false);
      return;
    }

    setNotice(
      `Customer saved and ${sent} installation${sent === 1 ? '' : 's'} added to the operations queue.${awaitingApproval ? ` ${awaitingApproval} ${awaitingApproval === 1 ? 'is' : 'are'} waiting for the admin to approve the price.` : ''}`,
    );
    setForm(emptyForm);
    setVehicles([newVehicle()]);
    setSavedCustomer(null);
    setSaving(false);
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
            {pkg?.key === 'customize' ? (
              <label className="field field--full">
                <span className="field__label">Additional features</span>
                <textarea className="input input--area" rows={2} maxLength={1200} placeholder="One feature per line, e.g. 2-way communication" value={vehicle.packageFeatures} onChange={updateVehicle(vehicle.id, 'packageFeatures')} />
              </label>
            ) : null}
            {pkg?.key === 'personal' ? (
              <label className="field">
                <span className="field__label">Device ownership</span>
                <select className="input" value={vehicle.deviceOwnership} onChange={updateVehicle(vehicle.id, 'deviceOwnership')}>
                  <option value="customer">Customer-owned</option>
                  <option value="company">Company-owned</option>
                </select>
              </label>
            ) : null}
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
              <div className="drawer__section-label">Vehicles &amp; installation</div>
              {packages.status === 'error' ? (
                <p className="form-alert" role="alert">Package rates could not be loaded: {packages.error}</p>
              ) : null}
              {packages.status === 'loading' ? <p className="field__hint">Loading package rates…</p> : null}
              {packages.status === 'ready' && packages.rows.length > 0 && packages.rows.every((pkg) => !pkg.configured) ? (
                <p className="quote-note" data-state="over">
                  No package has a rate yet, so nothing can be quoted. Ask the admin to set package pricing, or save this customer as a follow-up.
                </p>
              ) : null}

              {vehicles.map((vehicle, index) => {
                const { pkg, state } = quoteStateFor(vehicle, packages.rows);
                return (
                  <fieldset className="vehicle-block" key={vehicle.id}>
                    <legend className="vehicle-block__title">
                      Vehicle {index + 1}
                      {vehicles.length > 1 ? (
                        <button type="button" className="vehicle-block__remove" onClick={() => removeVehicle(vehicle.id)} disabled={saving}>
                          Remove
                        </button>
                      ) : null}
                    </legend>
                    <div className="field-grid">
                      <label className="field">
                        <span className="field__label">Car name / label <i>Required</i></span>
                        <input className="input" required maxLength={120} placeholder="e.g. Corolla GLi" value={vehicle.vehicleLabel} onChange={updateVehicle(vehicle.id, 'vehicleLabel')} />
                      </label>
                      <label className="field">
                        <span className="field__label">Registration <i>Required</i></span>
                        <input className="input" required maxLength={60} placeholder="e.g. ABC-1234" value={vehicle.vehicleRegistration} onChange={updateVehicle(vehicle.id, 'vehicleRegistration')} />
                      </label>
                      <label className="field field--full">
                        <span className="field__label">Installation station / location <i>Required</i></span>
                        <input className="input" required maxLength={120} placeholder="City or office where the fitting happens" value={vehicle.station} onChange={updateVehicle(vehicle.id, 'station')} />
                      </label>
                    </div>

                    <div className="pkg-pick" role="radiogroup" aria-label={`Service package for vehicle ${index + 1}`}>
                      {packages.rows.map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          role="radio"
                          aria-checked={vehicle.packageKey === row.key}
                          className={`pkg-pick__option${vehicle.packageKey === row.key ? ' is-active' : ''}${row.configured ? '' : ' is-unpriced'}`}
                          onClick={() => choosePackage(vehicle.id, row)}
                          disabled={!row.configured}
                          title={row.configured ? row.summary : 'The admin has not set a rate for this package yet.'}
                        >
                          <span className="pkg-pick__name">{row.name}</span>
                          <span className="pkg-pick__price">{row.configured ? formatMoney(row.price) : 'Not priced'}</span>
                        </button>
                      ))}
                    </div>

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
                            placeholder={pkg?.price ? String(pkg.price) : 'Minimum price'}
                            value={vehicle.quotedPrice}
                            onChange={updateVehicle(vehicle.id, 'quotedPrice')}
                          />
                        </div>
                      </label>
                      {state === 'below' ? (
                        <label className="field">
                          <span className="field__label">Why the discount?</span>
                          <input
                            className="input"
                            maxLength={500}
                            placeholder="Goes to the admin with the request"
                            value={vehicle.approvalReason}
                            onChange={updateVehicle(vehicle.id, 'approvalReason')}
                          />
                        </label>
                      ) : null}
                    </div>

                    {state ? (
                      <p className="quote-note" data-state={state}>
                        {state === 'below'
                          ? `Below the ${pkg.name} minimum of ${formatMoney(pkg.price)}. This installation waits for the admin to approve the price before operations can complete it.`
                          : null}
                        {state === 'exact' ? `At the ${pkg.name} minimum price. No approval needed.` : null}
                        {state === 'above' ? `Above the ${pkg.name} minimum of ${formatMoney(pkg.price)}. No approval needed.` : null}
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}

              <button type="button" className="btn btn--outline vehicle-add" onClick={addVehicle} disabled={saving}>
                + Add another vehicle
              </button>

              <div className="field-grid">
                <label className="field">
                  <span className="field__label">Installation date</span>
                  <input className="input" type="date" value={form.installDate} onChange={update('installDate')} />
                </label>
                <label className="field">
                  <span className="field__label">Installation time</span>
                  <input className="input" type="time" value={form.installTime} onChange={update('installTime')} />
                </label>
                <p className="field__hint field--full">The slot you ask for applies to every vehicle above. Operations confirms it and assigns the technician.</p>
              </div>
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
              {saving ? 'Saving…' : isInstallation ? (vehicles.length > 1 ? `Save & send ${vehicles.length} vehicles to operations` : 'Save & send to operations') : 'Save customer'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
