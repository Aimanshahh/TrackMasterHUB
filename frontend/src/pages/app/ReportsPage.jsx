import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function ReportsPage() {
  useDocumentTitle('Reports');

  return (
    <Panel heading="Reports">
      <p className="panel__note">
        The reporting workspace compiles the customer register, sales pipeline, renewals, pricing
        approvals and audit history into one picture.
      </p>
    </Panel>
  );
}
