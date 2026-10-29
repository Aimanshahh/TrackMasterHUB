import InventoryPanel from '../../components/operations/InventoryPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsInventoryPage() {
  useDocumentTitle('Inventory');

  return <InventoryPanel />;
}
