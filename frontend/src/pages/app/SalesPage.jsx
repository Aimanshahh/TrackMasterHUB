import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function SalesPage() {
  useDocumentTitle('Sales');

  return (
    <Panel heading="Sales">
      <p className="panel__note">
        Headline: the sales queue. Details: quotations, approvals and pricing decisions are stored
        per customer.
      </p>
    </Panel>
  );
}
