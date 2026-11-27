import { useEffect, useState } from 'react';

import { fetchShezzPreview, fetchStockPortalPreview, runShezzSync, runStockPortalSync } from '../../lib/api.js';

const HOW_TEXT = { exact: 'Matched', alias: 'Matched (remembered)', suggested: 'Check this match' };

/**
 * Brings the devices Shezz Traders handed to each technician into the Hub.
 * Names that match exactly are applied by themselves; anything else is picked
 * from a list once and remembered.
 */
const SOURCES = {
  shezz: { name: 'Shezz Traders', load: fetchShezzPreview, run: runShezzSync, intro: 'Devices handed to technicians on Shezz, matched to the technicians created here.', column: 'Name on Shezz', empty: 'Shezz Traders has not handed any devices to technicians yet.' },
  portal: { name: 'the tracking portal', load: fetchStockPortalPreview, run: runStockPortalSync, intro: 'Who holds each device on the tracking portal: the technician accounts under the technician stock user, matched to the technicians created here.', column: 'Group on the portal', empty: 'The technician stock account on the tracking portal lists no devices yet.' },
};

export default function ShezzSyncDrawer({ onClose, onDone, source = 'shezz' }) {
  const from = SOURCES[source] ?? SOURCES.shezz;
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [choices, setChoices] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    from.load()
      .then((payload) => {
        const initial = {};
        for (const group of payload.data.groups) {
          if (group.match) initial[group.key] = group.match.technicianId;
        }
        setChoices(initial);
        setState({ status: 'ready', data: payload.data, error: null });
      })
      .catch((error) => setState({ status: 'error', data: null, error: error.message }));
  }, []);

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = state.data?.groups ?? [];
  const selected = groups.filter((group) => choices[group.key]);
  const deviceTotal = selected.reduce((sum, group) => sum + group.newDevices + group.toReassign, 0);

  async function run() {
    setRunning(true);
    try {
      // Only hand-picked or suggested rows are sent as mappings; exact matches need none.
      const mappings = {};
      for (const group of selected) {
        if (!group.match || group.match.how === 'suggested' || group.match.technicianId !== choices[group.key]) mappings[group.key] = choices[group.key];
      }
      const payload = await from.run(mappings);
      setResult(payload.data);
      onDone?.();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={`Fetch devices from ${from.name}`}>
      <button type="button" className="drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="drawer drawer--wide">
        <header className="drawer__head">
          <div>
            <h2>Fetch from {from.name}</h2>
            <p>{from.intro}</p>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={onClose}>Close</button>
        </header>
        <div className="drawer__body">
          {state.status === 'loading' ? <p className="data-state" role="status">Reading from {from.name}…</p> : null}
          {state.error ? <p className="form-alert" role="alert">{state.error}</p> : null}

          {result ? (
            <div className="shezz-result">
              <h3>Import finished</h3>
              <ul>
                <li><strong>{result.created}</strong> new devices added</li>
                <li><strong>{result.reassigned}</strong> moved to a different technician</li>
                <li><strong>{result.unchanged}</strong> already correct</li>
                {result.fitted ? <li><strong>{result.fitted}</strong> left alone because they are fitted to a job</li> : null}
                {result.invalid ? <li><strong>{result.invalid}</strong> skipped, IMEI not valid</li> : null}
                {result.skippedNames.length ? <li>Not imported (no technician chosen): {result.skippedNames.join(', ')}</li> : null}
              </ul>
            </div>
          ) : null}

          {state.status === 'ready' && !result ? (
            groups.length === 0 ? (
              <>
                <p className="panel__note">
                  {source === 'portal' && state.data?.source?.shape?.totalDevices
                    ? `The portal lists ${state.data.source.shape.totalDevices} devices, but none say which technician holds them (${state.data.source.shape.ownersFound} tied to an account, the rest in no named group).`
                    : from.empty}
                </p>
                {source === 'portal' && state.data?.source?.shape ? (
                  <div className="panel__note">
                    <strong>What the portal sends (field names only):</strong>
                    <p>Groups: {state.data.source.shape.groups.map((group) => `${group.title} (${group.devices})`).join(', ') || 'none'}</p>
                    <p>Device fields: {state.data.source.shape.deviceFields.join(', ') || '—'}</p>
                    <p>Device data fields: {state.data.source.shape.deviceDataFields.join(', ') || '—'}</p>
                    <p>Send this to the developer so the technician can be read from the right field.</p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {state.data.truncated ? <p className="panel__note">Only the first 2,000 devices were read. Run the import again afterwards for the rest.</p> : null}
                {state.data.technicians.length === 0 ? <p className="form-alert" role="alert">No technicians exist here yet. Create them first so the names can be matched.</p> : null}
                <div className="ledger-wrap">
                  <table className="ledger ledger--stack">
                    <thead>
                      <tr><th>{from.column}</th><th>Devices</th><th>Technician in the Hub</th><th>Will happen</th></tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <tr key={group.key}>
                          <td data-label={from.column}><strong>{group.shezzName}</strong></td>
                          <td data-label="Devices">{group.deviceCount}</td>
                          <td data-label="Technician">
                            <select
                              className="input"
                              value={choices[group.key] ?? ''}
                              onChange={(event) => setChoices((current) => ({ ...current, [group.key]: event.target.value }))}
                              aria-label={`Technician for ${group.shezzName}`}
                            >
                              <option value="">Skip for now</option>
                              {state.data.technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
                            </select>
                            {group.match ? <small className="shezz-how" data-how={group.match.how}>{HOW_TEXT[group.match.how]}</small> : <small className="shezz-how">No match, choose one</small>}
                          </td>
                          <td data-label="Will happen">
                            {group.newDevices} new{group.toReassign ? `, ${group.toReassign} to move` : ''}
                            {group.fitted ? <small className="shezz-how">{group.fitted} fitted, untouched</small> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : null}
        </div>
        {state.status === 'ready' && !result && groups.length > 0 ? (
          <footer className="drawer__foot">
            <button type="button" className="btn btn--outline btn--small" onClick={onClose} disabled={running}>Cancel</button>
            <button type="button" className="btn btn--primary btn--small" onClick={run} disabled={running || selected.length === 0}>
              {running ? 'Importing…' : `Import ${deviceTotal} devices`}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
