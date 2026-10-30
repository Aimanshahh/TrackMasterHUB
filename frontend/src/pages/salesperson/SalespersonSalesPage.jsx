import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/**
 * The sales workflow (quotations, negotiated rates, approvals, renewals) is the
 * next module on the plan. Until it is connected there is nothing truthful to
 * display, so this page explains exactly what will live here.
 */
const upcoming = [
  ['Quotations', 'Build a quotation from an approved package and price option.'],
  ['Sales submission', 'Submit a sale with negotiated rates and track the approval decision.'],
  ['Renewals', 'Start a renewal for an eligible customer and follow the outcome.'],
  ['My performance', 'Your own accepted sales and renewals, without business-wide totals.'],
];

export default function SalespersonSalesPage() {
  useDocumentTitle('Sales & renewals');

  return (
    <div className="sp-sales">
      <section className="sp-sales__intro">
        <p className="app-page-head__eyebrow">NEXT MODULE</p>
        <h2>Selling and renewals are not connected yet.</h2>
        <p>
          TrackMaster Hub does not display invented sales numbers. This area will show your own quotations, submitted
          sales and renewals as soon as the pricing and approval workflow is implemented in the backend.
        </p>
      </section>

      <ul className="sp-sales__list">
        {upcoming.map(([title, copy]) => (
          <li key={title}>
            <strong>{title}</strong>
            <p>{copy}</p>
          </li>
        ))}
      </ul>

      <p className="sp-sales__note">
        In the meantime you can keep customer records and installation requests moving from <Link to="/salesperson/customers">your customers</Link>.
      </p>
    </div>
  );
}
