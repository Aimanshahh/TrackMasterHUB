import { useState } from 'react';

import InventoryPanel from '../../components/operations/InventoryPanel.jsx';
import ShezzSyncDrawer from '../../components/operations/ShezzSyncDrawer.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsInventoryPage() {
  useDocumentTitle('Inventory');
  const [syncing, setSyncing] = useState(null);
  const [version, setVersion] = useState(0);

  return (
    <>
      <div className="inventory-toolbar">
        <p>Devices come from <strong>Shezz Traders</strong>, which records what is handed to each technician. Each device is then checked against the tracking portal by its IMEI; the Portal column says whether it is there.</p>
        <div className="inventory-toolbar__actions">
          <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing('shezz')}>Fetch from Shezz</button>
        </div>
      </div>
      <InventoryPanel key={version} />
      {syncing ? <ShezzSyncDrawer source={syncing} onClose={() => setSyncing(null)} onDone={() => setVersion((current) => current + 1)} /> : null}
    </>
  );
}
