import ComplaintsPanel from '../../components/operations/ComplaintsPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsComplaintsPage() {
  useDocumentTitle('Complaints');

  return <ComplaintsPanel heading="Service tickets" />;
}
