import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useCustomers } from '../../hooks/useCustomers.js';
import { clearCustomerHotLead, fetchHotLeads, setCustomerHotLead } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const STATUSES = [
  ['ready_for_installation', 'Ready for installation'],
  ['vehicle_unavailable', 'Vehicle unavailable'],
  ['rescheduled', 'Installation rescheduled'],
  ['follow_up_required', 'Follow-up required'],
  ['converted', 'Converted'],
  ['lost', 'Lost'],
];

const STATUS_LABEL = Object.fromEntries(STATUSES);

export default function SalespersonHotLeadsPage() {
  useDocumentTitle('Hot leads');
  const [leads, setLeads] = useState({ status: 'loading', rows: [], error: null });
  const [search, setSearch] = useState('');
  const [draftFor, setDraftFor] = useState(null);
  const [draft, setDraft] = useState({ status: 'ready_for_installation', reason: '', nextFollowUp: '', remarks: '', packageKey: '' });
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const customers = useCustomers({ search, limit: 6 });

  const load = useCallback(async (signal) => {
    try {
      const payload = await fetchHotLeads({}, { signal });
      setLeads({ status: 'ready', rows: payload.data ?? [], error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setLeads((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function save(customerId, payload) {
    setBusy(customerId);
    setFeedback(null);
    try {
      await setCustomerHotLead(customerId, payload);
      setDraftFor(null);
      setSearch('');
      await load();
      setFeedback({ tone: 'ok', text: 'Hot lead saved.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function convert(id, status) {
    setBusy(`status-${id}`);
    setFeedback(null);
    try {
      const lead = leads.rows.find((row) => row.id === id);
      await setCustomerHotLead(id, {
        status,
        reason: lead?.reason ?? '',
        remarks: lead?.remarks ?? '',
        expectedDate: lead?.expectedDate ?? undefined,
        nextFollowUp: lead?.nextFollowUp ?? undefined,
        packageKey: lead?.packageKey ?? undefined,
      });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function remove(id) {
    setBusy(`remove-${id}`);
    setFeedback(null);
    try {
      await clearCustomerHotLead(id, {});
      await load();
      setFeedback({ tone: 'ok', text: 'Lead closed. The customer record is unchanged.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="field-page">
      <div className="field-strip">
        <div><span>Open leads</span><strong>{leads.rows.length}</strong></div>
        <div><span>Ready to install</span><strong>{leads.rows.filter((row) => row.status === 'ready_for_installation').length}</strong></div>
        <div><span>Follow-up due</span><strong>{leads.rows.filter((row) => row.nextFollowUp && new Date(row.nextFollowUp) <= new Date()).length}</strong></div>
      </div>

      {feedback ? (
        <div className={`field-message field-message--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      ) : null}

      <section className="field-block">
        <header className="field-block__head">
          <h2>Move a customer into hot leads</h2>
          <p>Search an existing customer. The lead is a flag on that same record, so converting it later never creates a duplicate.</p>
        </header>

        <label className="field-field">
          <span>Find a customer</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone or company" />
        </label>

        {search.trim().length >= 2 ? (
          customers.rows.length ? (
            <ul className="field-tasks">
              {customers.rows.map((customer) => (
                <li key={customer.id}>
                  <div>
                    <p className="field-tasks__name">{customer.name}</p>
                    <p className="field-tasks__meta">{customer.phone || 'No phone'} · {customer.company || customer.category || 'No category'}</p>
                  </div>
                  <div className="field-tasks__action">
                    <button type="button" className="btn btn--outline btn--small" onClick={() => { setDraftFor(customer); setDraft({ status: 'ready_for_installation', reason: '', nextFollowUp: '', remarks: '', packageKey: customer.packageKey ?? '' }); }}>
                      Mark as hot lead
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-note">{customers.status === 'loading' ? 'Searching…' : 'No customer matches that search.'}</p>
          )
        ) : null}

        {draftFor ? (
          <form
            className="field-form field-form--panel"
            onSubmit={(event) => {
              event.preventDefault();
              save(draftFor.id, {
                status: draft.status,
                reason: draft.reason,
                remarks: draft.remarks,
                nextFollowUp: draft.nextFollowUp || undefined,
                packageKey: draft.packageKey || undefined,
              });
            }}
          >
            <h3>{draftFor.name}</h3>
            <div className="field-row">
              <label className="field-field">
                <span>Lead status</span>
                <select value={draft.status} onChange={(event) => setDraft((p) => ({ ...p, status: event.target.value }))}>
                  {STATUSES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </label>
              <label className="field-field">
                <span>Next follow-up</span>
                <input type="date" value={draft.nextFollowUp} onChange={(event) => setDraft((p) => ({ ...p, nextFollowUp: event.target.value }))} />
              </label>
            </div>
            <label className="field-field">
              <span>Why is it delayed?</span>
              <input type="text" value={draft.reason} onChange={(event) => setDraft((p) => ({ ...p, reason: event.target.value }))} placeholder="Vehicle unavailable, waiting for salary, …" />
            </label>
            <label className="field-field">
              <span>Remarks</span>
              <textarea rows={2} value={draft.remarks} onChange={(event) => setDraft((p) => ({ ...p, remarks: event.target.value }))} />
            </label>
            <div className="field-actions">
              <button type="submit" className="btn btn--primary btn--small" disabled={busy === draftFor.id}>
                {busy === draftFor.id ? 'Saving…' : 'Save hot lead'}
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setDraftFor(null)}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="field-block">
        <header className="field-block__head">
          <h2>Your hot leads</h2>
          <p>Customers who have agreed to buy but are not installed yet.</p>
        </header>

        {leads.error ? <div className="field-alert" role="alert"><p>{leads.error}</p></div> : null}

        {leads.rows.length ? (
          <ul className="field-leads">
            {leads.rows.map((lead) => (
              <li key={lead.id} className="field-lead">
                <div className="field-lead__main">
                  <Link className="field-lead__name" to={`/salesperson/customers/${lead.id}`}>{lead.name}</Link>
                  <p className="field-lead__meta">{lead.phone || 'No phone'} · {lead.packageKey ? lead.packageKey : 'No package chosen'}</p>
                  {lead.reason ? <p className="field-lead__reason">{lead.reason}</p> : null}
                  <p className="field-lead__meta">
                    Next follow-up: {lead.nextFollowUp ? formatDateTime(lead.nextFollowUp) : 'not set'}
                    {lead.expectedDate ? ` · Expected install: ${formatDateTime(lead.expectedDate)}` : ''}
                  </p>
                </div>
                <div className="field-lead__side">
                  <select
                    aria-label={`Status for ${lead.name}`}
                    value={lead.status}
                    disabled={busy === `status-${lead.id}`}
                    onChange={(event) => convert(lead.id, event.target.value)}
                  >
                    {STATUSES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <span className="field-chip field-chip--warn">{STATUS_LABEL[lead.status] ?? lead.status}</span>
                  <button type="button" className="field-link-button" disabled={busy === `remove-${lead.id}`} onClick={() => remove(lead.id)}>Close lead</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="field-empty">
            <p className="field-empty__title">No hot leads yet</p>
            <p>Search a customer above and mark them as a hot lead when they are interested but not installed. Nothing is shown here until a real customer is flagged.</p>
          </div>
        )}
      </section>
    </div>
  );
}
