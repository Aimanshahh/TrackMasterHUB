import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import ModuleEmptyState from '../../components/app/ModuleEmptyState.jsx';

export default function PricingPage() {
  useDocumentTitle('Pricing');

  return <ModuleEmptyState eyebrow="Commercial controls" title="Pricing" description="Package rates and approved pricing rules will live here once the pricing data model and sales approval workflow are implemented." items={["Service packages and standard rates", "Customer-specific negotiated pricing", "Approval rules for exceptions"]} />;
}
