import { useEffect, useState } from 'react';

import { bindPortalSim, fetchStockPortalReport } from '../../lib/api.js';

const ISSUES = [
  ['missingInHub', 'On the portal, not in the Hub'],
  ['heldByOther', 'Held by a different technician in the Hub'],
  ['simToBind', 'SIM on the portal, empty in the Hub'],
  ['simMismatch', 'SIM differs from the Hub'],
  ['notOnPortal', 'In the Hub, not on the portal'],
];

/** Read-only comparison of each technician's portal account with the Hub. Only the SIM Bind button writes anything. */
export default function PortalCheckDrawer({ onClose, onChanged }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    fetchStockPortalReport()
      .then((payload) => setState({ status: 'ready', data: payload.data, error: null }))
      .catch((error) => setState({ status: 'error', data: null, error: error.message }));
  }
  useEffect(load, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function bind(imei) {
    setBusy(imei); setMessage('');
    try {
      const out = await bindPortalSim(imei);
      setMessage(`SIM ${out.data.simNumber} bound to ${imei}. It is not marked configured.`);
      onChanged?.();
      load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  const data = state.data;
  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Check against the portal">
      <button type="button" className="drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="drawer drawer--wide">
        <header className="drawer__head">
          <div>
            <h2>Check against the portal</h2>
            <p>Compares each technician&apos;s portal account with the Hub. Nothing is imported or changed here.</p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={onClose}>Close</button>
        </header>
        <div className="drawer__body">
          {state.status === 'loading' ? <p className="data-state" role="status">Reading the portal…</p> : null}
          {state.error ? <p className="form-alert" role="alert">{state.error}</p> : null}
          {message ? <p className="panel__note" role="status">{message}</p> : null}
          {data ? (
            <>
              <div className="panel__note">
                <strong>Read from each technician&apos;s portal account</strong>
                <ul>{data.fields.fromPortal.map((line) => <li key={line}>{line}</li>)}</ul>
                <strong>Kept only in the Hub</strong>
                <ul>{data.fields.keptInHub.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
              {data.technicians.map((row) => (
                <section key={row.technician.id} className="panel__note">
                  <h3>{row.technician.name} {row.ok ? '· matches' : '· needs a look'}</h3>
                  <p>Portal account: {row.portalName}{row.login ? ` (${row.login})` : ''} · {row.portalDevices.length} on the portal, {row.hubDevices} in the Hub</p>
                  {ISSUES.map(([key, title]) => (row.issues[key].length ? (
                    <div key={key}>
                      <strong>{title}</strong>
                      <ul>
                        {row.issues[key].map((item) => (
                          <li key={item.imei}>
                            {item.imei}{item.sim ? ` · portal SIM ${item.sim}` : ''}{item.hubSim ? ` · Hub SIM ${item.hubSim}` : ''}
                            {key === 'simToBind' ? (
                              <> <button type="button" className="btn btn--outline btn--small" disabled={busy === item.imei} onClick={() => bind(item.imei)}>{busy === item.imei ? 'Binding…' : 'Bind SIM'}</button></>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null))}
                </section>
              ))}
              {data.unmatched.length ? <p className="panel__note">Portal accounts with no technician in the Hub: {data.unmatched.map((u) => `${u.portalName} (${u.devices})`).join(', ')}</p> : null}
              {data.withoutPortal.length ? <p className="panel__note">Technicians with no portal account listing devices: {data.withoutPortal.map((t) => t.name).join(', ')}</p> : null}
              {data.noAccountDevices ? <p className="panel__note">{data.noAccountDevices} portal devices are not under any technician account.</p> : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
