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
        <p><strong>Shezz Traders</strong> is where devices are handed to technicians (the supplier record). <strong>The tracking portal</strong> shows which technician account holds each device now. Use either to assign stock automatically; the same device is never added twice.</p>
        <div className="inventory-toolbar__actions">
          <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing('shezz')}>Fetch from Shezz</button>
          <button type="button" className="btn btn--outline btn--small" onClick={() => setSyncing('portal')}>Fetch from tracking portal</button>
        </div>
      </div>
      <InventoryPanel key={version} />
      {syncing ? <ShezzSyncDrawer source={syncing} onClose={() => setSyncing(null)} onDone={() => setVersion((current) => current + 1)} /> : null}
    </>
  );
}
