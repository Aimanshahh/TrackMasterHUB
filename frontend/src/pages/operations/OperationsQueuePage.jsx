import JobsPanel from '../../components/operations/JobsPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function OperationsQueuePage() {
  useDocumentTitle('Work queue');

  return <JobsPanel />;
}
