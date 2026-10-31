import ComplaintsPanel from '../../components/operations/ComplaintsPanel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function ManagerComplaintsPage() {
  useDocumentTitle('Complaints');

  return (
    <div className="mgr-complaints">
      <ComplaintsPanel heading="Complaint queue" />
      <p className="ledger-note">
        The manager reads the complaint queue to judge service quality. Tickets are logged and progressed by the sales and
        operations desks, which keeps the record with the team that speaks to the customer.
      </p>
    </div>
  );
}
