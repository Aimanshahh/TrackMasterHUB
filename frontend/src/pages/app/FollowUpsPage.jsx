import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function FollowUpsPage() {
  useDocumentTitle('Follow-ups');

  return (
    <Panel heading="Follow-ups">
      <p className="panel__note">
        The follow-up queue lists accounts that need contact. Each row carries the due date, the
        last outcome and the next action.
      </p>
    </Panel>
  );
}
