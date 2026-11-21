import { useEffect, useState } from 'react';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCustomerMessages, fetchCustomers, sendCustomerWhatsAppMessage, sendWhatsAppBroadcast } from '../../lib/api.js';

const STATUS_TEXT = { sent: 'Sent', failed: 'Failed', pending: 'Sending…', not_configured: 'Not sent — gateway not configured' };

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default function AdminMessagesPage() {
  useDocumentTitle('WhatsApp messages');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [state, setState] = useState({ loading: false, sending: false, error: null });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: null }));
      fetchCustomers({ q: search, limit: 20 }, { signal: controller.signal })
        .then((payload) => {
          setCustomers(payload.data ?? []);
          setState((current) => ({ ...current, loading: false }));
        })
        .catch((error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, loading: false, error: error.message })); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  useEffect(() => {
    if (!selected) { setMessages([]); return undefined; }
    const controller = new AbortController();
    fetchCustomerMessages(selected.id, { signal: controller.signal })
      .then((payload) => setMessages(payload.data?.messages ?? []))
      .catch((error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, error: error.message })); });
    return () => controller.abort();
  }, [selected]);

  async function send(event) {
    event.preventDefault();
    if ((!selected && !broadcast) || !body.trim()) return;
    if (broadcast && !window.confirm('Send this message to every customer with a phone number?')) return;
    setState((current) => ({ ...current, sending: true, error: null }));
    try {
      const payload = broadcast
        ? await sendWhatsAppBroadcast(body)
        : await sendCustomerWhatsAppMessage(selected.id, body);
      if (!broadcast) {
        setMessages((current) => [payload.data.message, ...current]);
        const { status, error: reason } = payload.data.message;
        if (status === 'sent') setToast({ tone: 'success', text: `Message sent to ${selected.name}.` });
        else if (status === 'failed') setToast({ tone: 'error', text: `Message to ${selected.name} failed${reason ? `: ${reason}` : '.'}` });
        else setToast({ tone: 'warning', text: 'Message saved, but the WhatsApp gateway is not configured so it was not sent.' });
      } else if (payload.data.status === 'sending') {
        setToast({ tone: 'success', text: `Sending ${payload.data.queued} messages. Each shows Sent or Failed in the customer's history.` });
      } else {
        setToast({ tone: 'warning', text: `${payload.data.queued} messages saved, but the WhatsApp gateway is not configured so none were sent.` });
      }
      setBody('');
    } catch (error) {
      setToast({ tone: 'error', text: error.message || 'The message could not be sent.' });
    } finally {
      setState((current) => ({ ...current, sending: false }));
    }
  }

  const recipient = broadcast ? 'All customers with a phone number' : selected ? `${selected.name} · ${selected.phone || 'no phone number'}` : null;

  return (
    <div className="wa">
      <div className="wa-bar">
        <p>Messages go out through the WhatsApp gateway. If it is not set up on the server, they are saved here and not sent.</p>
        <div className="wa-seg" role="group" aria-label="Recipients">
          <button type="button" className={!broadcast ? 'is-active' : ''} onClick={() => setBroadcast(false)}>One customer</button>
          <button type="button" className={broadcast ? 'is-active' : ''} onClick={() => setBroadcast(true)}>All customers</button>
        </div>
      </div>

      <div className="wa__grid">
        {!broadcast ? (
          <section className="wa-card">
            <header className="wa-card__head"><h2>Customer</h2></header>
            <input className="input" type="search" placeholder="Search name or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
            <ul className="wa-list wa-list--tall">
              {state.loading ? <li className="wa-list__note">Searching…</li> : null}
              {customers.map((customer) => (
                <li key={customer.id}>
                  <button type="button" className={selected?.id === customer.id ? 'is-selected' : ''} onClick={() => setSelected(customer)}>
                    <strong>{customer.name}</strong><span>{customer.phone || 'No phone'}</span>
                  </button>
                </li>
              ))}
              {!state.loading && customers.length === 0 ? <li className="wa-list__note">No customers found.</li> : null}
            </ul>
          </section>
        ) : (
          <section className="wa-card">
            <header className="wa-card__head"><h2>Everyone</h2></header>
            <p className="panel__note">The message goes to every customer with a phone number. Customers without one are skipped.</p>
          </section>
        )}

        <section className="wa-card">
          <header className="wa-card__head"><h2>{broadcast ? 'Broadcast message' : selected ? `Message ${selected.name}` : 'Write a message'}</h2></header>
          {broadcast || selected ? (
            <>
              <p className="wa-to">To <strong>{recipient}</strong></p>
              <form onSubmit={send}>
                <textarea className="input input--area" rows="7" maxLength="4096" placeholder="Write your WhatsApp message…" value={body} onChange={(event) => setBody(event.target.value)} />
                <div className="wa-actions">
                  <span>{body.length}/4096</span>
                  <button className="btn btn--primary" type="submit" disabled={state.sending || !body.trim() || (!broadcast && !selected?.phone)}>
                    {state.sending ? <><span className="wa-spinner" aria-hidden="true" />Sending…</> : 'Send message'}
                  </button>
                </div>
              </form>
              {!broadcast && messages.length ? (
                <div className="wa-history">
                  <h3>Message history</h3>
                  {messages.map((message) => (
                    <article key={message.id}>
                      <p>{message.body}</p>
                      <small className={`wa-status wa-status--${message.status}`}>{formatDate(message.createdAt)} · {STATUS_TEXT[message.status] ?? message.status}{message.status === 'failed' && message.error ? ` (${message.error})` : ''}</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : <p className="panel__note">Select a customer to write a message.</p>}
        </section>
      </div>

      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {toast ? (
        <div className={`wa-toast wa-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          <button type="button" className="wa-toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}
    </div>
  );
}
