import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function ComplaintsPage() {
  useDocumentTitle('Complaints');

  return (
    <Panel heading="Complaints">
      <p className="panel__note">
        The customer service desk opens the queue, confirms the complaint and starts the resolution.
        This screen is not yet connected to the ticket service.
      </p>
    </Panel>
  );
}
