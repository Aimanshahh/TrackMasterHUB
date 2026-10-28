import { useParams } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';

export default function CustomerDetailPage() {
  useDocumentTitle('Customer');
  const { customerId } = useParams();

  return (
    <Panel heading={`Customer · ${customerId ?? 'loading…'}`}>
      <p className="panel__note">
        No customer record is stored yet. Open the Customers page and add a customer to see their
        record here.
      </p>
    </Panel>
  );
}
