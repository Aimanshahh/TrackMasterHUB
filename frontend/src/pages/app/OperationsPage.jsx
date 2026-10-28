import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function OperationsPage() {
  useDocumentTitle('Operations');

  return (
    <Panel heading="Operations">
      <p className="panel__note">
        The field board lists the next jobs to schedule, their current stage and who owns them.
        This screen is not yet connected to the work queue.
      </p>
    </Panel>
  );
}
