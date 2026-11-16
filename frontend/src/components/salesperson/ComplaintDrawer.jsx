import { useEffect, useState } from 'react';

import { COMPLAINT_CATEGORIES, PRIORITY_OPTIONS } from '../../app/operations.js';
import CustomerPicker from '../customers/CustomerPicker.jsx';
import { createComplaintRecord } from '../../lib/api.js';

/** Log a service ticket against one of the salesperson's own customers. */
export default function ComplaintDrawer({
  open,
  defaultCustomerId = '',
  defaultCustomer = null,
  defaultTitle = '',
  defaultDescription = '',
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    customerId: defaultCustomerId,
    customerName: defaultCustomer?.name ?? '',
    phone: defaultCustomer?.phone ?? '',
    title: defaultTitle,
    description: defaultDescription,
    category: 'General',
    priority: 'normal',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setForm({
      customerId: defaultCustomerId,
      customerName: defaultCustomer?.name ?? '',
      phone: defaultCustomer?.phone ?? '',
      title: defaultTitle,
      description: defaultDescription,
      category: 'General',
      priority: 'normal',
    });
    setError(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, defaultCustomerId, defaultCustomer, defaultTitle, defaultDescription, saving, onClose]);

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!form.customerId) {
      setError('Select a customer from the search results.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createComplaintRecord(form);
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'The complaint could not be logged.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close complaint form" />
      <section className="drawer drawer--compact" role="dialog" aria-modal="true" aria-labelledby="complaint-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">Service ticket</p>
            <h2 className="drawer__title" id="complaint-title">Log a complaint</h2>
            <p className="drawer__subtitle">Operations will see it in their queue. You are notified as it moves.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <div className="field-grid">
            <label className="field field--full">
              <span className="field__label">Customer <i>Required</i></span>
              {defaultCustomer ? (
                <input className="input" value={`${defaultCustomer.name}${defaultCustomer.phone ? ` · ${defaultCustomer.phone}` : ''}`} readOnly />
              ) : (
                <CustomerPicker
                  value={form.customerId}
                  onChange={(customerId) => setForm((current) => ({ ...current, customerId }))}
                  required
                />
              )}
            </label>
            <label className="field field--full">
              <span className="field__label">Short title <i>Required</i></span>
              <input className="input" required minLength={3} maxLength={200} placeholder="e.g. Tracker offline since Tuesday" value={form.title} onChange={update('title')} autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Category</span>
              <select className="input" value={form.category} onChange={update('category')}>
                {COMPLAINT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Priority</span>
              <select className="input" value={form.priority} onChange={update('priority')}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field field--full">
              <span className="field__label">What happened</span>
              <textarea className="input input--area" rows={4} maxLength={3000} placeholder="What the customer reported, and anything already tried" value={form.description} onChange={update('description')} />
            </label>
          </div>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Logging…' : 'Log complaint'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
