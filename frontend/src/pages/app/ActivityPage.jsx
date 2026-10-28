import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function ActivityPage() {
  useDocumentTitle('Activity');

  return (
    <Panel heading="Activity">
      <p className="panel__note">
        This screen shows the recorded actions across the platform. Activity is not yet stored —
        records will appear here once the service layer records every account change, ownership
        reassignment and approval.
      </p>
    </Panel>
  );
}
