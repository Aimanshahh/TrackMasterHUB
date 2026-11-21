import { useEffect, useRef, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  createMessageTemplate, fetchMessageTemplates, previewTemplateMessage, searchDeskCustomers, sendTemplateMessage,
} from '../../lib/api.js';

/** Pick a customer and a template, check the filled-in message, then send it. */
export default function OperationsWhatsAppPage() {
  useDocumentTitle('WhatsApp templates');
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', body: '' });
  const [draftError, setDraftError] = useState(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    fetchMessageTemplates()
      .then((payload) => {
        setTemplates(payload.data ?? []);
        setVariables(payload.meta?.variables ?? []);
        if (payload.data?.length) setTemplateId((current) => current || payload.data[0].id);
      })
      .catch((error) => setToast({ tone: 'error', text: error.message }));
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) { setResults([]); return undefined; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchDeskCustomers(query, { signal: controller.signal })
        .then((payload) => { setResults(payload.data ?? []); setSearching(false); })
        .catch((error) => { if (error.name !== 'AbortError') setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  useEffect(() => {
    if (!customer || !templateId) { setPreview(null); return undefined; }
    const controller = new AbortController();
    previewTemplateMessage({ templateId, customerId: customer.id }, { signal: controller.signal })
      .then((payload) => setPreview(payload.data))
      .catch((error) => { if (error.name !== 'AbortError') setPreview({ error: error.message }); });
    return () => controller.abort();
  }, [customer, templateId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function send() {
    if (!preview?.canSend) return;
    setSending(true);
    try {
      const payload = await sendTemplateMessage({ templateId, customerId: customer.id });
      const result = payload.data;
      if (result.sent) setToast({ tone: 'success', text: `Sent to ${customer.name}. It now shows in their timeline.` });
      else setToast({ tone: 'error', text: result.error || 'The message was not sent.' });
    } catch (error) {
      setToast({ tone: 'error', text: error.message || 'The message could not be sent.' });
    } finally {
      setSending(false);
    }
  }

  function insertVariable(name) {
    const field = bodyRef.current;
    const token = `[${name}]`;
    if (!field) { setDraft((current) => ({ ...current, body: `${current.body}${token}` })); return; }
    const start = field.selectionStart ?? draft.body.length;
    const end = field.selectionEnd ?? start;
    setDraft((current) => ({ ...current, body: `${current.body.slice(0, start)}${token}${current.body.slice(end)}` }));
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setDraftError(null);
    try {
      const payload = await createMessageTemplate(draft);
      const created = payload.data.template;
      setTemplates((current) => [...current, created]);
      setTemplateId(created.id);
      setDraft({ name: '', body: '' });
      setAdding(false);
    } catch (error) {
      setDraftError(error.message || 'The template could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const selectedTemplate = templates.find((item) => item.id === templateId);

  return (
    <div className="wa">
      <div className="wa__grid">
        <section className="wa-card">
          <header className="wa-card__head"><h2>1 · Customer</h2></header>
          {customer ? (
            <div className="wa-chosen">
              <div><strong>{customer.name}</strong><span>{customer.phone || 'No phone number'}</span></div>
              <button type="button" className="btn btn--outline btn--small" onClick={() => { setCustomer(null); setPreview(null); }}>Change</button>
            </div>
          ) : (
            <>
              <input className="input" type="search" autoComplete="off" placeholder="Search name, phone or VRN" value={term} onChange={(event) => setTerm(event.target.value)} />
              <ul className="wa-list">
                {searching ? <li className="wa-list__note">Searching…</li> : null}
                {results.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => { setCustomer(item); setTerm(''); setResults([]); }}>
                      <strong>{item.name}</strong><span>{item.phone || 'No phone'}</span>
                    </button>
                  </li>
                ))}
                {!searching && term.trim().length >= 2 && results.length === 0 ? <li className="wa-list__note">No customer found.</li> : null}
                {term.trim().length < 2 ? <li className="wa-list__note">Type at least 2 characters to search.</li> : null}
              </ul>
            </>
          )}
        </section>

        <section className="wa-card">
          <header className="wa-card__head">
            <h2>2 · Template</h2>
            <button type="button" className="btn btn--outline btn--small" onClick={() => setAdding((current) => !current)}>{adding ? 'Cancel' : 'Add template'}</button>
          </header>
          {adding ? (
            <form className="wa-form" onSubmit={saveTemplate}>
              <label className="field"><span className="field__label">Template name</span>
                <input className="input" maxLength={80} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="field"><span className="field__label">Message</span>
                <textarea ref={bodyRef} className="input input--area" rows={5} maxLength={1000} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} required />
              </label>
              <div className="wa-chips" aria-label="Insert a variable">
                {variables.map((item) => <button type="button" key={item.name} onClick={() => insertVariable(item.name)}>[{item.name}]</button>)}
              </div>
              {draftError ? <p className="form-alert" role="alert">{draftError}</p> : null}
              <button type="submit" className="btn btn--primary btn--small" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
            </form>
          ) : (
            <>
              <select className="input" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {selectedTemplate ? <p className="wa-raw">{selectedTemplate.body}</p> : null}
            </>
          )}
        </section>
      </div>

      <section className="wa-card">
        <header className="wa-card__head"><h2>3 · Preview and send</h2></header>
        {!customer ? <p className="panel__note">Choose a customer to see the message.</p> : null}
        {customer && preview?.error ? <p className="form-alert" role="alert">{preview.error}</p> : null}
        {customer && preview && !preview.error ? (
          <>
            <div className="wa-bubble">{preview.text}</div>
            {preview.missing?.length ? (
              <ul className="wa-missing">
                {preview.missing.map((item) => <li key={item.name}>{item.hint}</li>)}
              </ul>
            ) : null}
            <div className="wa-actions">
              <button type="button" className="btn btn--primary" onClick={send} disabled={sending || !preview.canSend}>{sending ? 'Sending…' : 'Send on WhatsApp'}</button>
              <span>To {customer.phone || 'no phone number'}</span>
            </div>
          </>
        ) : null}
      </section>

      {toast ? (
        <div className={`wa-toast wa-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          <button type="button" className="wa-toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}
    </div>
  );
}
