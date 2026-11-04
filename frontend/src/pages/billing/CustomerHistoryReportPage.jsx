import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BUSINESS } from '../../content/business.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchCustomerHistory } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import '../../styles/invoice-print.css';

const day = (value) => (value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
const dayTime = (value) => (value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—');

function Totals({ rows, money = false }) {
  return (
    <dl className="rep-totals">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{money && typeof row.value === 'number' ? formatMoney(row.value) : row.value}</dd>
          <small>Source: {row.source}</small>
        </div>
      ))}
    </dl>
  );
}

/** Printable per-customer report: what was installed, what went wrong, who was contacted, and (for money roles) what was billed. */
export default function CustomerHistoryReportPage() {
  const { customerId } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  useDocumentTitle(state.data ? `History · ${state.data.customer.name}` : 'Customer history');

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerHistory(customerId, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', data: payload.data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }); });
    return () => controller.abort();
  }, [customerId]);

  if (state.status === 'loading') return <p className="inv-state" role="status">Preparing the report…</p>;
  if (state.status === 'error') {
    return (
      <div className="inv-state" role="alert">
        <p>The report could not be opened: {state.error}</p>
        <button type="button" className="btn btn--outline" onClick={() => window.history.back()}>Go back</button>
      </div>
    );
  }

  const { data } = state;
  const { customer } = data;

  return (
    <div className="inv-shell">
      <div className="inv-toolbar">
        <button type="button" className="btn btn--outline btn--small" onClick={() => window.history.back()}>← Back</button>
        <div className="inv-toolbar__right">
          <span className="inv-toolbar__hint">Choose “Save as PDF” in the print window to download a PDF.</span>
          <button type="button" className="btn btn--primary btn--small" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <article className="inv-sheet">
        <header className="inv-head">
          <div className="inv-brand"><div><strong className="inv-brand__name">{BUSINESS.name}</strong><span>Customer history report</span></div></div>
          <div className="inv-title"><h1>{customer.name}</h1><p className="inv-ref">Generated {dayTime(data.generatedAt)}</p></div>
        </header>

        <section className="rep-section">
          <h2>Customer</h2>
          <table className="rep-table"><tbody>
            <tr><th>Phone</th><td>{customer.phone || '—'}</td><th>Email</th><td>{customer.email || '—'}</td></tr>
            <tr><th>Company</th><td>{customer.company || '—'}</td><th>Account</th><td>{customer.accountStatus === 'active' ? 'Active' : 'Inactive'}</td></tr>
            <tr><th>Owner</th><td>{customer.owner || '—'}</td><th>Customer since</th><td>{day(customer.createdAt)}</td></tr>
            <tr><th>Follow-up</th><td>{customer.followUp ? day(customer.followUp) : 'None set'}</td><th>Notes</th><td>{customer.notes || 'None'}</td></tr>
          </tbody></table>
        </section>

        <section className="rep-section"><h2>Totals</h2><Totals rows={data.totals} /></section>

        <section className="rep-section">
          <h2>Installations</h2>
          {data.installations.length === 0 ? <p className="rep-empty">No installation has been requested for this customer.</p> : (
            <table className="rep-table">
              <thead><tr><th>Vehicle</th><th>Job</th><th>Status</th><th>Device / SIM</th><th>Dates</th></tr></thead>
              <tbody>
                {data.installations.map((row) => (
                  <tr key={row.reference}>
                    <td>{[row.vehicle.label, row.vehicle.registration].filter(Boolean).join(' · ') || '—'}{row.packageName ? <span className="rep-sub">{row.packageName}</span> : null}</td>
                    <td>{row.reference}<span className="rep-sub">{row.requestType === 'follow_up' ? 'Follow-up visit' : 'New installation'}</span></td>
                    <td>{row.statusLabel}{row.technician ? <span className="rep-sub">{row.technician}</span> : null}</td>
                    <td>{row.deviceImei || '—'}<span className="rep-sub">{row.simNumber || ''}</span></td>
                    <td>Requested {day(row.requestedAt)}{row.completedAt ? <span className="rep-sub">Completed {day(row.completedAt)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rep-section">
          <h2>Complaints</h2>
          {data.complaints.length === 0 ? <p className="rep-empty">No complaint has been logged for this customer.</p> : (
            <table className="rep-table">
              <thead><tr><th>Complaint</th><th>Status</th><th>Time to resolve</th><th>Status changes</th></tr></thead>
              <tbody>
                {data.complaints.map((row) => (
                  <tr key={row.reference}>
                    <td>{row.title}<span className="rep-sub">{row.reference} · {row.category} · logged {dayTime(row.loggedAt)}</span></td>
                    <td>{row.statusLabel}</td>
                    <td>{row.timeToResolve ?? 'Not resolved yet'}</td>
                    <td>{row.history.length === 0 ? 'None recorded' : row.history.map((h, i) => (
                      <span className="rep-sub" key={i}>{dayTime(h.at)} · {String(h.status).replace(/_/g, ' ')}{h.note ? ` — ${h.note}` : ''}</span>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rep-section">
          <h2>Email and WhatsApp</h2>
          {data.messages.length === 0 ? <p className="rep-empty">No email or WhatsApp message has been sent to this customer from the system.</p> : (
            <table className="rep-table">
              <thead><tr><th>When</th><th>Channel</th><th>About</th><th>Result</th></tr></thead>
              <tbody>
                {data.messages.map((m) => (
                  <tr key={m.id}><td>{dayTime(m.createdAt)}</td><td>{m.channelLabel}</td><td>{m.subject}<span className="rep-sub">{m.complaintReference}</span></td><td>{m.statusLabel}{m.error ? <span className="rep-sub">{m.error}</span> : null}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rep-section">
          <h2>Calls</h2>
          {data.calls.rows.length === 0 ? <p className="rep-notice">{data.calls.label}.</p> : (
            <table className="rep-table">
              <thead><tr><th>When</th><th>Result</th><th>Duration</th><th>Keypress</th><th>Alert</th></tr></thead>
              <tbody>
                {data.calls.rows.map((c) => (
                  <tr key={c.id}><td>{dayTime(c.calledAt)}</td><td>{c.statusLabel}</td><td>{c.durationSeconds}s</td><td>{c.dtmf || '—'}</td><td>{c.alertType || '—'}{c.alertId ? <span className="rep-sub">#{c.alertId}</span> : null}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {data.money ? (
          <section className="rep-section">
            <h2>Money</h2>
            <Totals rows={data.money.totals} money />
            {data.money.invoices.length > 0 ? (
              <table className="rep-table" style={{ marginTop: 10 }}>
                <thead><tr><th>Invoice</th><th>Status</th><th>Amount</th><th>Received</th><th>Balance</th></tr></thead>
                <tbody>
                  {data.money.invoices.map((inv) => (
                    <tr key={inv.id}><td>{inv.reference}<span className="rep-sub">{inv.vehicle?.registration}</span></td><td>{inv.status === 'issued' ? inv.paymentState : inv.status}</td><td>{formatMoney(inv.amount)}</td><td>{formatMoney(inv.netReceived ?? inv.paidAmount)}</td><td>{formatMoney(inv.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rep-empty" style={{ marginTop: 8 }}>No invoice exists for this customer.</p>}
          </section>
        ) : null}

        <section className="rep-section">
          <h2>Service timeline</h2>
          {data.timeline.length === 0 ? <p className="rep-empty">Nothing has happened on this account yet.</p> : (
            <table className="rep-table">
              <thead><tr><th>When</th><th>Event</th><th>Source</th></tr></thead>
              <tbody>
                {data.timeline.map((e, i) => (
                  <tr key={i}><td>{dayTime(e.at)}</td><td>{e.title}{e.detail ? <span className="rep-sub">{e.detail}</span> : null}</td><td>{e.source}{e.ref ? <span className="rep-sub">{e.ref}</span> : null}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="inv-foot"><p>Sensitive identity details (CNIC, date of birth, E-PIN) are never included in this report.</p></footer>
      </article>
      <p className="inv-back no-print"><Link to="/">Return to the app</Link></p>
    </div>
  );
}
