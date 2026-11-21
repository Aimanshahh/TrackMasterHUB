import { useState } from 'react';

import InventoryPanel from '../../components/operations/InventoryPanel.jsx';
import ShezzSyncDrawer from '../../components/operations/ShezzSyncDrawer.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsInventoryPage() {
  useDocumentTitle('Inventory');
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <div className="inventory-toolbar">
        <p>Devices are handed to technicians on Shezz Traders. Fetch them here to assign them automatically.</p>
        <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing(true)}>Fetch from Shezz</button>
      </div>
      <InventoryPanel key={version} />
      {syncing ? <ShezzSyncDrawer onClose={() => setSyncing(false)} onDone={() => setVersion((current) => current + 1)} /> : null}
    </>
  );
}
