import { useEffect, useRef, useState } from 'react';

import { fetchCertificatePdf } from '../../lib/api.js';

/**
 * Shows the real PDF the server generates, so what is previewed is exactly what
 * is downloaded or printed. The file is fetched with the session cookie and
 * shown from a temporary in-memory URL.
 */
export default function CertificatePreview({ certificate, onClose }) {
  const [state, setState] = useState({ status: 'loading', url: null, blob: null, error: null });
  const frameRef = useRef(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setState({ status: 'loading', url: null, blob: null, error: null });

    fetchCertificatePdf(certificate.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl, blob, error: null });
      })
      .catch((error) => { if (!cancelled) setState({ status: 'error', url: null, blob: null, error: error.message }); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate.id]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fileName = `Tracker-Certificate-${certificate.number}.pdf`;

  function print() {
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      window.open(state.url, '_blank', 'noopener');
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close preview" />
      <section className="cert-preview" role="dialog" aria-modal="true" aria-labelledby="cert-preview-title">
        <header className="cert-preview__head">
          <div>
            <p className="drawer__eyebrow">{certificate.vehicle.registration} · {certificate.customer.name}</p>
            <h2 className="drawer__title" id="cert-preview-title">Certificate {certificate.number}</h2>
          </div>
          <div className="cert-preview__actions">
            <button type="button" className="btn btn--outline btn--small" disabled={state.status !== 'ready'} onClick={print}>Print</button>
            <a
              className={`btn btn--primary btn--small${state.status !== 'ready' ? ' is-disabled' : ''}`}
              href={state.url ?? undefined}
              download={fileName}
              aria-disabled={state.status !== 'ready'}
            >
              Download PDF
            </a>
            <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="cert-preview__body">
          {state.status === 'loading' ? <p className="data-state" role="status">Preparing the certificate…</p> : null}
          {state.status === 'error' ? <p className="form-alert" role="alert">The certificate could not be opened: {state.error}</p> : null}
          {state.status === 'ready' ? <iframe ref={frameRef} className="cert-preview__frame" title={`Certificate ${certificate.number}`} src={state.url} /> : null}
        </div>
      </section>
    </div>
  );
}
