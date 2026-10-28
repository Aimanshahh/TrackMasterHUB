import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import Panel from '../../components/app/Panel.jsx';
import CustomerTable from '../../components/customers/CustomerTable.jsx';

export default function CustomersPage() {
  useDocumentTitle('Customers');

  const rows = [];

  return (
    <div className="customers-page">
      <Panel heading="Customer register">
        <p className="panel__note">
          The customer register lists every account in the business, with owner, category and
          priority. New records come in from the salesperson workspaces.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <Panel heading="No customers yet">
          <p className="panel__note">
            The customer register is empty. A salesperson creates the first account and the backend
            assigns the owner automatically.
          </p>
        </Panel>
      ) : (
        <CustomerTable rows={rows} onSelect={() => undefined} />
      )}
    </div>
  );
}
