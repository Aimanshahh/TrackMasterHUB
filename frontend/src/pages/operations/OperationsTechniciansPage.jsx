import TechniciansPanel from '../../components/operations/TechniciansPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsTechniciansPage() {
  useDocumentTitle('Technicians');

  return <TechniciansPanel />;
}
