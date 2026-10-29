import { Link } from 'react-router-dom';

import Panel from '../app/Panel.jsx';
import { useTechnicianStock } from '../../hooks/useOperations.js';

/**
 * Devices and SIMs each technician is holding. Held stock is available for the
 * next installation; fitted stock is already on a job.
 */
export default function TechnicianStockPanel({ heading = 'Stock with technicians', techniciansLink = '/operations/technicians' }) {
  const stock = useTechnicianStock();
  const lowCount = stock.rows.filter((row) => row.low).length;

  return (
    <Panel
      heading={heading}
      action={(
        <div className="customer-actions">
          {techniciansLink ? <Link className="panel__link" to={techniciansLink}>Technicians →</Link> : null}
          <button type="button" className="btn btn--outline btn--small" onClick={stock.refresh}>Refresh</button>
        </div>
      )}
    >
      {stock.error ? <p className="app-notice app-notice--error" role="alert">Technician stock is unavailable: {stock.error}</p> : null}
      {stock.status === 'loading' ? <p className="data-state" role="status">Loading technician stock…</p> : null}

      {stock.status !== 'loading' && !stock.error && stock.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>No technicians registered</h2>
          <p>Add the field team and hand them devices from inventory. Counts appear here once stock is assigned.</p>
        </div>
      ) : null}

      {stock.rows.length > 0 ? (
        <div className="ops-table__scroll">
          <table className="users-table ops-table-plain ops-station-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Station</th>
                <th>Devices held</th>
                <th>Fitted</th>
                <th>SIMs held</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.rows.map((row) => (
                <tr key={row.technicianId} className={row.low ? 'is-low' : undefined}>
                  <td><strong>{row.name}</strong></td>
                  <td className="ops-cell-muted">{row.station || '—'}</td>
                  <td className="ops-number">{row.devices.held}</td>
                  <td className="ops-number">{row.devices.fitted}</td>
                  <td className="ops-number">{row.sims.held}</td>
                  <td>
                    {row.low
                      ? <span className="ops-low">Low · under {stock.threshold}</span>
                      : <span className="ops-status" data-tone="done">Stocked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ops-foot-note">
        A technician is flagged when fewer than {stock.threshold} unfitted devices are left.
        {lowCount > 0 ? ` ${lowCount} technician${lowCount === 1 ? ' needs' : 's need'} restocking now.` : ' All technicians currently hold enough devices.'}
        {' '}The desk and admin receive one in-app alert per technician when this happens.
      </p>
    </Panel>
  );
}
