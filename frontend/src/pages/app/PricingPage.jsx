import { useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { usePackages } from '../../hooks/usePackages.js';
import { formatDayTime } from '../../app/operations.js';
import { formatMoney } from '../../lib/format.js';

/**
 * The rate sheet the whole sales flow depends on. Each package carries two
 * numbers: the standard rate, and the lowest price a salesperson may agree
 * without asking. A quote from the rate down to that price needs no approval;
 * anything lower comes back here as an approval request.
 */
function PackageRateRow({ pkg, index, onSave }) {
  const [form, setForm] = useState({
    price: pkg.price ?? '',
    minPrice: pkg.minPrice ?? '',
    summary: pkg.summary ?? '',
    features: (pkg.features ?? []).join('\n'),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setForm({
      price: pkg.price ?? '',
      minPrice: pkg.minPrice ?? '',
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
        // Empty means no separate lowest price: any discount off the rate needs approval.
        minPrice: form.minPrice === '' ? null : Number(form.minPrice),
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
  const rate = Number(form.price);
  const lowest = form.minPrice === '' ? null : Number(form.minPrice);
  const invalid = lowest !== null && Number.isFinite(rate) && rate > 0 && lowest > rate;

  return (
    <li className={`pcard${unset ? ' pcard--unset' : ''}`}>
      <form onSubmit={submit}>
        <header className="pcard__head">
          <div>
            <h3>{pkg.name}{unset ? <span className="rate-tag">Not priced</span> : null}</h3>
            <p>{pkg.summary || 'No description set.'}</p>
          </div>
          <dl className="pcard__now">
            <div><dt>Rate</dt><dd>{unset ? '—' : formatMoney(pkg.price)}</dd></div>
            <div><dt>Lowest</dt><dd>{pkg.minPrice !== null && pkg.minPrice !== undefined ? formatMoney(pkg.minPrice) : '—'}</dd></div>
          </dl>
        </header>

        <div className="pcard__fields">
          <label className="pcard__field">
            <span>Standard rate</span>
            <div className="money-input">
              <em aria-hidden="true">PKR</em>
              <input className="input" type="number" inputMode="decimal" min="1" step="1" required placeholder="e.g. 15500" value={form.price} onChange={update('price')} />
            </div>
            <small>What the package is sold for.</small>
          </label>
          <label className="pcard__field">
            <span>Lowest price without approval</span>
            <div className="money-input">
              <em aria-hidden="true">PKR</em>
              <input className="input" type="number" inputMode="decimal" min="0" step="1" placeholder="e.g. 11000" value={form.minPrice} onChange={update('minPrice')} />
            </div>
            <small>Quotes from the rate down to this need no approval.</small>
          </label>
        </div>

        {invalid ? <p className="form-alert" role="alert">The lowest price cannot be above the standard rate.</p> : null}

        <details className="rate-row__more">
          <summary>Description and inclusions</summary>
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">One-line description</span>
              <input className="input" maxLength={300} placeholder="What this package is for" value={form.summary} onChange={update('summary')} />
            </label>
            <label className="field field--full">
              <span className="field__label">What the customer gets</span>
              <textarea className="input input--area" rows={4} maxLength={1200} placeholder={'One inclusion per line\ne.g. Live GPS tracking'} value={form.features} onChange={update('features')} />
            </label>
          </div>
        </details>

        {error ? <p className="form-alert" role="alert">{error}</p> : null}

        <footer className="pcard__foot">
          <span className="rate-row__stamp" role="status">
            {savedAt ? `Saved ${formatDayTime(savedAt)}` : pkg.configured && pkg.updatedAt ? `Updated ${formatDayTime(pkg.updatedAt)}` : ''}
          </span>
          <button type="submit" className="btn btn--primary" disabled={saving || invalid}>{saving ? 'Saving…' : unset ? 'Set rate' : 'Save'}</button>
        </footer>
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
          <h2>Set each package’s rate and the lowest price a salesperson may agree.</h2>
          <p>
            Example: rate 15,500 and lowest price 11,000. Any quote from 15,500 down to 11,000 goes
            through with no approval. A quote below 11,000 waits for your approval before operations
            can complete the installation. Leave the lowest price empty and every discount needs approval.
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
        <ol className="pcard-grid">
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
