import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function PricingPage() {
  useDocumentTitle('Pricing');

  return (
    <Panel heading="Pricing">
      <p className="panel__note">
        Packages, standard rates and negotiated corporate rates are configured here. Below-minimum
        pricing must be approved before it becomes a sale.
      </p>
    </Panel>
  );
}
