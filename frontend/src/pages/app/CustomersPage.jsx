import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import Panel from '../../components/app/Panel.jsx';
import CustomerTable from '../../components/customers/CustomerTable.jsx';
import { createCustomer } from '../../lib/api.js';

export default function CustomersPage() {
  useDocumentTitle('Customers');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ category: '', priority: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', category: '', priority: 'normal' });
  const customers = useCustomers({ search, category: filters.category, priority: filters.priority, limit: 50 });
  const rows = useMemo(() => customers.rows, [customers.rows]);

  async function submitCustomer(event) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await createCustomer(form);
      setForm({ name: '', email: '', phone: '', company: '', category: '', priority: 'normal' });
      setCreateOpen(false);
      await customers.refresh();
    } catch (error) {
      setFormError(error.message || 'Customer could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="customers-page">
    <Panel heading="Customer register" action={<div className="customer-actions"><button type="button" className="btn btn--primary btn--small" onClick={() => setCreateOpen(true)}>Add customer <span aria-hidden="true">+</span></button><button type="button" className="btn btn--outline btn--small" onClick={customers.refresh}>Refresh</button></div>}>
      <p className="panel__note">All customer records returned by MongoDB. Admin access is business-wide; records are never fabricated in the browser.</p>
      {createOpen ? <div className="drawer-root" role="presentation">
        <button type="button" className="drawer-backdrop" onClick={() => setCreateOpen(false)} aria-label="Close customer form" />
        <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-customer-title">
          <header className="drawer__head">
            <div><p className="drawer__eyebrow">Customer register</p><h2 className="drawer__title" id="create-customer-title">Add a customer</h2><p className="drawer__subtitle">Create a record in the live business database.</p></div>
            <button type="button" className="drawer__close" onClick={() => setCreateOpen(false)} aria-label="Close">×</button>
          </header>
          <form className="drawer__form" onSubmit={submitCustomer}>
            <div className="drawer__section-label">Contact details</div>
            <div className="field-grid">
              <label className="field field--full"><span className="field__label">Customer name <i>Required</i></span><input className="input" autoFocus required maxLength={200} autoComplete="name" placeholder="Full name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="field"><span className="field__label">Phone <i>Required</i></span><input className="input" type="tel" required maxLength={60} autoComplete="tel" placeholder="Phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className="field"><span className="field__label">Email address</span><input className="input" type="email" maxLength={240} autoComplete="email" placeholder="name@company.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label className="field"><span className="field__label">Company</span><input className="input" maxLength={200} autoComplete="organization" placeholder="Company name" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} /></label>
            </div>
            <div className="drawer__section-label">Record details</div>
            <div className="field-grid">
              <label className="field"><span className="field__label">Customer category</span><select className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}><option value="">Select a category</option><option value="Individual">Individual</option><option value="Fleet">Fleet</option><option value="Corporate">Corporate</option><option value="Dealer">Dealer</option><option value="Other">Other</option></select></label>
              <label className="field"><span className="field__label">Priority</span><select className="input" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            </div>
            {formError ? <p className="form-alert" role="alert">{formError}</p> : null}
            <footer className="drawer__foot"><button type="button" className="btn btn--outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving record…' : 'Save customer'}</button></footer>
          </form>
        </section>
      </div> : null}
      {customers.error ? <p className="app-notice app-notice--error" role="alert">{customers.error}</p> : null}
      {customers.status === 'loading' ? <p className="data-state" role="status">Loading customer records…</p> : null}
      {customers.status !== 'loading' && !customers.error && rows.length === 0 ? <div className="app-empty"><span className="app-empty__mark" aria-hidden="true">—</span><h2>No customer records yet</h2><p>Customers will appear here once real records have been added to the database.</p></div> : null}
      <div className="customer-filters">
        <div className="customer-table__search"><input className="customer-table__search-input" aria-label="Search customers" placeholder="Search by name, email, phone or company…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label><span>Category</span><select aria-label="Filter customers by category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option><option value="Individual">Individual</option><option value="Fleet">Fleet</option><option value="Corporate">Corporate</option><option value="Dealer">Dealer</option><option value="Other">Other</option></select></label>
        <label><span>Priority</span><select aria-label="Filter customers by priority" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
        <span className="field__hint">{customers.meta?.total ?? rows.length} records</span>
      </div>
      {rows.length > 0 ? <CustomerTable customers={rows} showToolbar={false} onSelect={(id) => navigate(`/admin/customers/${id}`)} /> : null}
    </Panel>
  </div>;
}
