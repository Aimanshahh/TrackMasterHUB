import { useEffect, useState } from 'react';

import { cancelCertificateRecord, reissueCertificateRecord } from '../../lib/api.js';

/**
 * Reissue replaces a certificate with a new numbered one (the old one is kept and
 * marked Replaced). Cancel withdraws it with no replacement. Both need a reason,
 * which is stored with the certificate.
 */
export default function CertificateActionDrawer({ certificate, mode, onClose, onDone }) {
  const isReissue = mode === 'reissue';
  const [form, setForm] = useState({
    reason: '',
    makeModel: certificate.vehicle.makeModel,
    engineNo: certificate.vehicle.engineNo,
    chassisNo: certificate.vehicle.chassisNo,
    colour: certificate.vehicle.colour,
    address: certificate.customer.address,
    cnic: certificate.customer.cnic,
    showCnic: certificate.showCnic,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (form.reason.trim().length < 3) return setError('Write the reason first. It is kept with the certificate.');

    setSaving(true);
    try {
      const payload = isReissue
        ? await reissueCertificateRecord(certificate.id, {
          reason: form.reason,
          vehicle: { makeModel: form.makeModel, engineNo: form.engineNo, chassisNo: form.chassisNo, colour: form.colour },
          customer: { address: form.address, cnic: form.cnic },
          showCnic: form.showCnic,
        })
        : await cancelCertificateRecord(certificate.id, { reason: form.reason });
      await onDone(payload.data.certificate, mode);
      onClose();
    } catch (error_) {
      setError(error_.message || 'That could not be saved.');
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="cert-action-title">
        <header className="drawer__head">
          <div>
            <p className="drawer__eyebrow">{certificate.number} · {certificate.vehicle.registration}</p>
            <h2 className="drawer__title" id="cert-action-title">{isReissue ? 'Reissue certificate' : 'Cancel certificate'}</h2>
            <p className="drawer__subtitle">
              {isReissue
                ? 'A new certificate number is issued. This one stays on record, marked as replaced.'
                : 'The certificate is withdrawn and stamped Cancelled. You can issue a fresh one for the vehicle afterwards.'}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Reason <i>Required</i></span>
            <input
              className="input"
              maxLength={400}
              autoFocus
              placeholder={isReissue ? 'e.g. Chassis number corrected' : 'e.g. Tracker removed from the vehicle'}
              value={form.reason}
              onChange={update('reason')}
              required
            />
          </label>

          {isReissue ? (
            <>
              <div className="drawer__section-label">Correct anything that was wrong</div>
              <div className="field-grid">
                <label className="field"><span className="field__label">Make / model</span><input className="input" maxLength={120} value={form.makeModel} onChange={update('makeModel')} /></label>
                <label className="field"><span className="field__label">Colour</span><input className="input" maxLength={40} value={form.colour} onChange={update('colour')} /></label>
                <label className="field"><span className="field__label">Engine no.</span><input className="input" maxLength={60} value={form.engineNo} onChange={update('engineNo')} /></label>
                <label className="field"><span className="field__label">Chassis no.</span><input className="input" maxLength={60} value={form.chassisNo} onChange={update('chassisNo')} /></label>
                <label className="field field--full"><span className="field__label">Customer address</span><input className="input" maxLength={400} value={form.address} onChange={update('address')} /></label>
                <label className="field"><span className="field__label">CNIC</span><input className="input" maxLength={20} value={form.cnic} onChange={update('cnic')} /></label>
                <label className="field cert-check">
                  <input type="checkbox" checked={form.showCnic} onChange={(event) => setForm((current) => ({ ...current, showCnic: event.target.checked }))} />
                  <span>Print the CNIC on the certificate</span>
                </label>
              </div>
            </>
          ) : null}

          {error ? <p className="form-alert" role="alert">{error}</p> : null}

          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Back</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isReissue ? 'Reissue certificate' : 'Cancel certificate'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
