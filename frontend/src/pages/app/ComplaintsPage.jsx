import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import ModuleEmptyState from '../../components/app/ModuleEmptyState.jsx';

export default function ComplaintsPage() {
  useDocumentTitle('Complaints');

  return <ModuleEmptyState eyebrow="Customer care" title="Complaints" description="A shared service queue will let the team record customer issues and track each response through resolution. No complaint service is connected yet." items={["Issue records linked to customers", "Ownership and priority", "Resolution status and update history"]} />;
}
