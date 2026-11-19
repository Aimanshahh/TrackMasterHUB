import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

const oneYearFromToday = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

export default function AmcPaymentDrawer({ customer, jobs, open, onClose, onSubmit }) {
  const expiredJobs = jobs.filter((job) => job.status === 'completed' && job.amcExpiryDate && new Date(job.amcExpiryDate) < new Date(new Date().toISOString().slice(0, 10)));
  const [form, setForm] = useState({
    jobId: '',
    amount: '',
    method: 'bank_transfer',
    receivedAt: today(),
    amcExpiryDate: oneYearFromToday(),
    transactionRef: '',
    note: '',
    proof: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({ ...current, jobId: expiredJobs[0]?.id ?? '', amount: '', transactionRef: '', note: '', proof: null }));
    setError(null);
  }, [open, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function readProof(event) {
    const file = event.target.files?.[0];
    if (!file) return setForm((current) => ({ ...current, proof: null }));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return setError('Payment proof must be a JPG, PNG or WebP image.');
    }
    if (file.size > 500 * 1024) {
      return setError('Payment proof must be smaller than 500 KB.');
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({
      ...current,
      proof: { name: file.name, mimeType: file.type, dataUrl: reader.result },
    }));
    reader.onerror = () => setError('The payment screenshot could not be read.');
    reader.readAsDataURL(file);
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(customer.id, form);
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'The AMC payment could not be recorded.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close AMC payment form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="amc-payment-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">AMC renewal · {customer.name}</p>
            <h2 className="drawer__title" id="amc-payment-title">Record AMC payment</h2>
            <p className="drawer__subtitle">Record the payment and renew the AMC expiry date for this vehicle.</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Expired vehicle <i>Required</i></span>
            <select className="input" value={form.jobId} onChange={update('jobId')} required>
              {expiredJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {[job.vehicle?.registration, job.vehicle?.label].filter(Boolean).join(' · ') || job.reference}
                </option>
              ))}
            </select>
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field__label">Amount received <i>Required</i></span>
              <input className="input" type="number" min="1" step="1" value={form.amount} onChange={update('amount')} required />
            </label>
            <label className="field">
              <span className="field__label">Payment method</span>
              <select className="input" value={form.method} onChange={update('method')}>
                <option value="jazzcash">JazzCash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Date received</span>
              <input className="input" type="date" value={form.receivedAt} max={today()} onChange={update('receivedAt')} required />
            </label>
            <label className="field">
              <span className="field__label">New AMC expiry <i>Required</i></span>
              <input className="input" type="date" value={form.amcExpiryDate} min={today()} onChange={update('amcExpiryDate')} required />
            </label>
            <label className="field field--full">
              <span className="field__label">Transaction reference</span>
              <input className="input" maxLength={120} placeholder="JazzCash, EasyPaisa or bank transaction ID" value={form.transactionRef} onChange={update('transactionRef')} />
            </label>
            <label className="field field--full">
              <span className="field__label">Payment screenshot <i>Optional</i></span>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={readProof} />
              {form.proof ? <span className="ledger__sub">{form.proof.name} attached</span> : null}
            </label>
            <label className="field field--full">
              <span className="field__label">Note</span>
              <input className="input" maxLength={400} placeholder="Optional payment note" value={form.note} onChange={update('note')} />
            </label>
          </div>

          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving || !form.jobId}>{saving ? 'Recording…' : 'Record AMC payment'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
