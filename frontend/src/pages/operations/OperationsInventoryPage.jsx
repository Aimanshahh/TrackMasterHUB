import { useState } from 'react';

import InventoryPanel from '../../components/operations/InventoryPanel.jsx';
import PortalCheckDrawer from '../../components/operations/PortalCheckDrawer.jsx';
import ShezzSyncDrawer from '../../components/operations/ShezzSyncDrawer.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsInventoryPage() {
  useDocumentTitle('Inventory');
  const [syncing, setSyncing] = useState(null);
  const [version, setVersion] = useState(0);

  return (
    <>
      <div className="inventory-toolbar">
        <p>Devices come from <strong>Shezz Traders</strong>, which records what is handed to each technician. Each device is then matched to the tracking portal by its IMEI, shown in the Portal column.</p>
        <div className="inventory-toolbar__actions">
          <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing('shezz')}>Fetch from Shezz</button>
          <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing('portal')}>Check against portal</button>
        </div>
      </div>
      <InventoryPanel key={version} />
      {syncing === 'portal' ? <PortalCheckDrawer onClose={() => setSyncing(null)} onChanged={() => setVersion((current) => current + 1)} /> : null}
      {syncing === 'shezz' ? <ShezzSyncDrawer source={syncing} onClose={() => setSyncing(null)} onDone={() => setVersion((current) => current + 1)} /> : null}
    </>
  );
}
