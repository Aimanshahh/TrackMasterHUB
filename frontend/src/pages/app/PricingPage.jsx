import { useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { usePackages } from '../../hooks/usePackages.js';
import { formatDayTime } from '../../app/operations.js';

/**
 * The rate sheet the whole sales flow depends on. The admin owns the numbers;
 * every quote a salesperson makes starts from these figures, and anything
 * quoted below them reaches this same workspace as an approval.
 */
function PackageRateRow({ pkg, index, onSave }) {
  const [form, setForm] = useState({
    price: pkg.price ?? '',
    summary: pkg.summary ?? '',
    features: (pkg.features ?? []).join('\n'),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setForm({
      price: pkg.price ?? '',
      summary: pkg.summary ?? '',
      features: (pkg.features ?? []).join('\n'),
    });
  }, [pkg]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setSavedAt(null);
  };

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onSave(pkg.key, {
        price: Number(form.price),
        summary: form.summary,
        features: form.features.split('\n'),
      });
      setSavedAt(new Date().toISOString());
    } catch (saveError) {
      setError(saveError.message || 'The rate could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const unset = !pkg.configured;

  return (
    <li className={`rate-row${unset ? ' rate-row--unset' : ''}`}>
      <div className="rate-row__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>

      <form className="rate-row__form" onSubmit={submit}>
        <header className="rate-row__head">
          <div>
            <h3>
              {pkg.name}
              {unset ? <span className="rate-tag">Not priced</span> : null}
            </h3>
            <p className="rate-row__summary">
              {pkg.summary || 'No wording set — the salesperson only sees the rate.'}
            </p>
          </div>
          <p className="rate-row__current">
            <span>Current rate</span>
            <strong>{unset ? 'Not set' : formatMoney(pkg.price)}</strong>
          </p>
        </header>

        <div className="rate-row__controls">
          <label className="field field--price">
            <span className="field__label">Package rate</span>
            <div className="money-input">
              <em aria-hidden="true">PKR</em>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                required
                placeholder={unset ? 'Set the first rate' : String(pkg.price)}
                value={form.price}
                onChange={update('price')}
              />
            </div>
          </label>

          <div className="rate-row__save">
            <button type="submit" className="btn btn--primary btn--small" disabled={saving}>
              {saving ? 'Saving…' : unset ? 'Set rate' : 'Update rate'}
            </button>
            <span className="rate-row__stamp" role="status">
              {savedAt
                ? `Saved ${formatDayTime(savedAt)}`
                : pkg.configured && pkg.updatedAt
                  ? `Updated ${formatDayTime(pkg.updatedAt)}`
                  : ''}
            </span>
          </div>
        </div>

        <details className="rate-row__more">
          <summary>Wording and inclusions</summary>
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">One-line description</span>
              <input
                className="input"
                maxLength={300}
                placeholder="What this package is for"
                value={form.summary}
                onChange={update('summary')}
              />
            </label>
            <label className="field field--full">
              <span className="field__label">What the customer gets</span>
              <textarea
                className="input input--area"
                rows={4}
                maxLength={1200}
                placeholder={'One inclusion per line\ne.g. Live GPS tracking'}
                value={form.features}
                onChange={update('features')}
              />
              <span className="field__hint">Shown to the salesperson when they quote this package.</span>
            </label>
          </div>
        </details>

        {error ? <p className="form-alert" role="alert">{error}</p> : null}
      </form>
    </li>
  );
}

export default function PricingPage() {
  useDocumentTitle('Pricing');
  const packages = usePackages();

  return (
    <div className="pricing-page">
      <section className="pricing-lede">
        <div>
          <p className="app-page-head__eyebrow">COMMERCIAL CONTROLS</p>
          <h2>One rate per package. Nothing is quoted without one.</h2>
          <p>
            These are the prices every installation quote starts from. A salesperson can quote at the
            package rate straight away; quoting below it creates an approval request here, and the
            installation cannot be completed until you decide.
          </p>
        </div>
      </section>

      {packages.error ? (
        <p className="app-notice app-notice--error" role="alert">Package pricing is unavailable: {packages.error}</p>
      ) : null}

      {packages.status === 'loading' ? (
        <p className="data-state" role="status">Loading package rates…</p>
      ) : null}

      {packages.rows.length > 0 ? (
        <ol className="rate-sheet">
          {packages.rows.map((pkg, index) => (
            <PackageRateRow key={pkg.key} pkg={pkg} index={index} onSave={packages.save} />
          ))}
        </ol>
      ) : null}

      <p className="rate-sheet__note">
        Prices are stored in MongoDB and reused by the operations desk and the salesperson app. Changing a
        rate never rewrites an installation that was already quoted — each job keeps the rate it was sold at.
      </p>
    </div>
  );
}
