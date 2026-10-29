import JobsPanel from '../../components/operations/JobsPanel.jsx';
import StationStockPanel from '../../components/operations/StationStockPanel.jsx';
import TechnicianStockPanel from '../../components/operations/TechnicianStockPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsPage() {
  useDocumentTitle('Operations');

  return (
    <div className="ops-overview">
      <StationStockPanel inventoryLink="" />
      <TechnicianStockPanel techniciansLink="" />
      <JobsPanel heading="Operations queue" />
    </div>
  );
}
