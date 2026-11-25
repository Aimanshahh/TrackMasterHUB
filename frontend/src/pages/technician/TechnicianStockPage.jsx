import { useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTechnicianStock } from '../../hooks/useTechnician.js';
import { formatDateTime } from '../../lib/format.js';

export default function TechnicianStockPage() {
  useDocumentTitle('My stock');
  const [tab, setTab] = useState('devices');
  const { data, status, error, refresh } = useTechnicianStock();

  const devices = data?.devices ?? [];
  const sims = data?.sims ?? [];
  const counts = data?.counts;

  return (
    <div className="tech-page">
      {counts ? (
        <div className="tech-metrics tech-metrics--three">
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.devicesAvailable}</span>
            <span className="tech-metric__label">Devices ready to fit</span>
          </div>
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.simsAvailable}</span>
            <span className="tech-metric__label">SIMs ready to fit</span>
          </div>
          <div className="tech-metric">
            <span className="tech-metric__value">{counts.devicesInstalled}</span>
            <span className="tech-metric__label">Devices installed</span>
          </div>
        </div>
      ) : null}

      <div className="tech-filters" role="tablist" aria-label="Stock type">
        <button type="button" role="tab" aria-selected={tab === 'devices'} className={`tech-filter${tab === 'devices' ? ' is-active' : ''}`} onClick={() => setTab('devices')}>
          Devices ({devices.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sims'} className={`tech-filter${tab === 'sims' ? ' is-active' : ''}`} onClick={() => setTab('sims')}>
          SIMs ({sims.length})
        </button>
      </div>

      {status === 'loading' ? <p className="tech-state">Loading your stock…</p> : null}
      {error ? (
        <div className="tech-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--outline btn--small" onClick={refresh}>Try again</button>
        </div>
      ) : null}

      {!error && status !== 'loading' ? (
        tab === 'devices' ? (
          devices.length ? (
            <ul className="tech-stock">
              {devices.map((device) => (
                <li key={device.id} className="tech-stock__row">
                  <div>
                    <p className="tech-stock__id">{device.imei}</p>
                    <p className="tech-stock__meta">{device.model || 'Model not recorded'}</p>
                  </div>
                  <div className="tech-stock__right">
                    <span className={`tech-pill tech-pill--${device.status === 'installed' ? 'ok' : device.status === 'assigned' ? 'warn' : 'plain'}`}>
                      {device.statusLabel}
                    </span>
                    {device.installedAt ? <span className="tech-stock__date">{formatDateTime(device.installedAt)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="tech-empty">
              <p className="tech-empty__title">No devices issued to you yet</p>
              <p>Operations issues device stock to each technician. Once a device is assigned to you it appears here with its IMEI, and only these devices can be selected during installation.</p>
            </div>
          )
        ) : sims.length ? (
          <ul className="tech-stock">
            {sims.map((sim) => (
              <li key={sim.id} className="tech-stock__row">
                <div>
                  <p className="tech-stock__id">{sim.number}</p>
                  <p className="tech-stock__meta">{sim.operator || 'Operator not recorded'}</p>
                </div>
                <div className="tech-stock__right">
                  <span className={`tech-pill tech-pill--${sim.status === 'installed' ? 'ok' : sim.status === 'assigned' ? 'warn' : 'plain'}`}>
                    {sim.statusLabel}
                  </span>
                  {sim.installedAt ? <span className="tech-stock__date">{formatDateTime(sim.installedAt)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tech-empty">
            <p className="tech-empty__title">No SIMs issued to you yet</p>
            <p>SIM stock is issued by operations along with the devices. A SIM that is not in your stock cannot be used in an installation.</p>
          </div>
        )
      ) : null}
    </div>
  );
}
