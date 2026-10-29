import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import ModuleEmptyState from '../../components/app/ModuleEmptyState.jsx';

export default function OperationsPage() {
  useDocumentTitle('Operations');

  return <ModuleEmptyState eyebrow="Field operations" title="Operations" description="The operations workspace will coordinate stock, technicians and station-level jobs. The workflow is not yet connected to persisted records." items={["IMEI device stock and SIM inventory", "Technician records managed by Operations", "Station-wise device and SIM assignments", "Assignment history and job ownership"]} />;
}
