import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function SalesPage() {
  useDocumentTitle('Sales');

  return (
    <section className="sales-workspace">
      <div className="sales-workspace__heading">
        <p className="app-page-head__eyebrow">COMMERCIAL WORKSPACE</p>
        <h2>Sales</h2>
        <p>Keep quotes, approvals and completed sales together in one clear view.</p>
      </div>
      <div className="sales-workspace__cards">
        <article><strong>Sales pipeline</strong><span>Track each customer from quote to completed sale.</span></article>
        <article><strong>Customer quotes</strong><span>View package, price and salesperson details together.</span></article>
        <article><strong>Approval history</strong><span>Review decisions and keep every commercial record visible to Admin.</span></article>
      </div>
      <p className="sales-workspace__note">Sales records will appear here as soon as the sales workflow is connected. No sample figures are shown.</p>
    </section>
  );
}
