import { Link } from 'react-router-dom';

import Panel from '../app/Panel.jsx';
import { useStockByStation } from '../../hooks/useOperations.js';

/**
 * Device and SIM availability per station. A station below the low-stock
 * threshold is flagged here and raises an in-app alert when it happens.
 */
export default function StationStockPanel({ heading = 'Stock by station', inventoryLink = '/operations/inventory' }) {
  const stock = useStockByStation();

  return (
    <Panel
      heading={heading}
      action={(
        <div className="customer-actions">
          {inventoryLink ? <Link className="panel__link" to={inventoryLink}>Inventory →</Link> : null}
          <button type="button" className="btn btn--outline btn--small" onClick={stock.refresh}>Refresh</button>
        </div>
      )}
    >
      {stock.error ? <p className="app-notice app-notice--error" role="alert">Station stock is unavailable: {stock.error}</p> : null}

      {stock.status === 'loading' ? <p className="data-state" role="status">Loading station stock…</p> : null}

      {stock.status !== 'loading' && !stock.error && stock.rows.length === 0 ? (
        <div className="app-empty">
          <span className="app-empty__mark" aria-hidden="true">—</span>
          <h2>No stations recorded yet</h2>
          <p>Stations appear here once stock, a technician or a job records one. Nothing is generated for display.</p>
        </div>
      ) : null}

      {stock.rows.length > 0 ? (
        <div className="ops-table__scroll">
          <table className="users-table ops-table-plain ops-station-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Devices available</th>
                <th>Devices assigned</th>
                <th>SIMs available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.rows.map((row) => (
                <tr key={row.station} className={row.low ? 'is-low' : undefined}>
                  <td><strong>{row.station}</strong></td>
                  <td className="ops-number">{row.devices.in_stock}</td>
                  <td className="ops-number">{row.devices.assigned}</td>
                  <td className="ops-number">{row.sims.in_stock}</td>
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
        A station is flagged when fewer than {stock.threshold} devices are available. The desk and admin receive one
        in-app alert per station when it drops below that level.
      </p>
    </Panel>
  );
}
