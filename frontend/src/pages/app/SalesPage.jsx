import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import ModuleEmptyState from '../../components/app/ModuleEmptyState.jsx';

export default function SalesPage() {
  useDocumentTitle('Sales');

  return <ModuleEmptyState eyebrow="Commercial workflow" title="Sales" description="Quotes, approvals and completed sales will be managed here when the sales records and workflow are connected." items={["Sales pipeline and status", "Quotes linked to customer records", "Approval history and outcomes"]} />;
}
