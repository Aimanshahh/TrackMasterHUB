import { useEffect, useState } from 'react';

import Panel from '../../components/app/Panel.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCustomerMessages, fetchCustomers, sendCustomerWhatsAppMessage, sendWhatsAppBroadcast } from '../../lib/api.js';

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
  const [state, setState] = useState({ loading: false, sending: false, error: null, notice: null });

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
    if (!selected) {
      setMessages([]);
      return undefined;
    }
    const controller = new AbortController();
    fetchCustomerMessages(selected.id, { signal: controller.signal })
      .then((payload) => setMessages(payload.data?.messages ?? []))
      .catch((error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, error: error.message })); });
    return () => controller.abort();
  }, [selected]);

  async function send(event) {
    event.preventDefault();
    if ((!selected && !broadcast) || !body.trim()) return;
    if (broadcast && !window.confirm('Save this message for every customer with a phone number?')) return;
    setState((current) => ({ ...current, sending: true, error: null, notice: null }));
    try {
      const payload = broadcast
        ? await sendWhatsAppBroadcast(body)
        : await sendCustomerWhatsAppMessage(selected.id, body);
      if (!broadcast) setMessages((current) => [payload.data.message, ...current]);
      setBody('');
      setState((current) => ({ ...current, sending: false, notice: broadcast ? `${payload.data.queued} messages saved. Meta WhatsApp connection is still required to deliver them.` : 'Message saved. Meta WhatsApp connection is still required to deliver it.' }));
    } catch (error) {
      setState((current) => ({ ...current, sending: false, error: error.message }));
    }
  }

  return (
    <div className="messages-workspace">
      <div className="messages-workspace__notice">Not connected yet: messages are saved safely in the Hub and are not sent until Meta credentials and templates are configured.</div>
      <div className="messages-workspace__toolbar">
        <div className="messages-workspace__toolbar-copy"><span className="messages-workspace__toolbar-icon" aria-hidden="true">➤</span><div><strong>Choose how to send</strong><span>Send to one customer or prepare one message for your full customer list.</span></div></div>
        <div className="messages-workspace__mode">
          <button type="button" className={!broadcast ? 'is-active' : ''} onClick={() => setBroadcast(false)}><span aria-hidden="true">●</span> One customer</button>
          <button type="button" className={broadcast ? 'is-active' : ''} onClick={() => setBroadcast(true)}><span aria-hidden="true">●●</span> All customers</button>
        </div>
      </div>
      <div className="messages-workspace__layout">
        {!broadcast ? <Panel heading={<span className="messages-workspace__panel-heading"><span className="messages-workspace__panel-icon" aria-hidden="true">●</span>Choose customer</span>}>
          <input className="input" placeholder="Search name or phone…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="messages-workspace__customers">
            {state.loading ? <p className="data-state">Searching…</p> : null}
            {customers.map((customer) => (
              <button type="button" className={`messages-workspace__customer${selected?.id === customer.id ? ' is-selected' : ''}`} key={customer.id} onClick={() => setSelected(customer)}>
                <span className="messages-workspace__avatar" aria-hidden="true">●</span><span className="messages-workspace__customer-copy"><strong>{customer.name}</strong><span>{customer.phone || 'No phone number'}</span></span>{selected?.id === customer.id ? <span className="messages-workspace__check" aria-hidden="true">✓</span> : null}
              </button>
            ))}
            {!state.loading && customers.length === 0 ? <p className="panel__note">No customers found.</p> : null}
          </div>
        </Panel> : <section className="messages-workspace__broadcast-card"><span className="messages-workspace__broadcast-icon">ALL</span><div><h3>All customers</h3><p>The message will be saved for every customer with a phone number. Customers without a phone number will be skipped.</p></div></section>}
        <Panel heading={<span className="messages-workspace__panel-heading"><span className="messages-workspace__panel-icon messages-workspace__panel-icon--message" aria-hidden="true">•••</span>{broadcast ? 'Broadcast message' : selected ? `Message ${selected.name}` : 'Write a message'}</span>}>
          {broadcast || selected ? (
            <>
              <p className="messages-workspace__recipient">To: <strong>{broadcast ? 'All customers with phone numbers' : selected.phone || 'No phone number'}</strong><button type="button" className="messages-workspace__copy" aria-label="Copy recipient">□</button></p>
              <form onSubmit={send}>
                <div className="messages-workspace__textarea-wrap"><textarea className="input input--area" rows="7" maxLength="4096" placeholder="Write your WhatsApp message…" value={body} onChange={(event) => setBody(event.target.value)} /><span className="messages-workspace__emoji" aria-hidden="true">☺</span></div>
                <div className="messages-workspace__compose-footer"><span>{body.length}/4096</span><button className="btn btn--primary messages-workspace__send" type="submit" disabled={state.sending || !body.trim() || (!broadcast && !selected?.phone)}><span aria-hidden="true">➤</span>{state.sending ? 'Saving…' : 'Send message'}</button></div>
              </form>
              {!broadcast && messages.length ? <div className="messages-workspace__history"><h3>Message history</h3>{messages.map((message) => <article key={message.id}><p>{message.body}</p><small>{formatDate(message.createdAt)} · Not sent — Meta setup required</small></article>)}</div> : null}
            </>
          ) : <p className="panel__note">Select a customer to write a message.</p>}
        </Panel>
      </div>
      {state.error ? <p className="app-notice app-notice--error" role="alert">{state.error}</p> : null}
      {state.notice ? <p className="app-notice" role="status">{state.notice}</p> : null}
    </div>
  );
}
