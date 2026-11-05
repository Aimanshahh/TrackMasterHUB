import { useState } from 'react';
import { Link } from 'react-router-dom';

import AdjustmentLedger from '../billing/AdjustmentLedger.jsx';
import InvoiceTable from '../billing/InvoiceTable.jsx';
import PaymentLedger from '../billing/PaymentLedger.jsx';
import CustomerTimeline from './CustomerTimeline.jsx';
import CertificatePreview from '../certificates/CertificatePreview.jsx';
import CertificateTable from '../certificates/CertificateTable.jsx';
import BriefingPanel, { AccountStateTag } from '../manager/BriefingPanel.jsx';
import { PriorityTag, StatusPill } from '../operations/OpsStatus.jsx';
import { formatDayTime } from '../../app/operations.js';
import { formatMoney } from '../../lib/format.js';

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/**
 * One customer, every record the business holds: identity, security briefing,
 * vehicles with their fitted IMEI and SIM, invoices, instalments and complaints.
 *
 * The same view serves the manager desk and the admin register so a customer can
 * never look different depending on which role opened them. Only the money
 * actions differ: the manager can issue an invoice and take a payment here, while
 * the admin is linked to the money records screen instead of acting twice.
 */
export default function CustomerAccountView({
  data,
  backTo,
  backLabel = 'Back to customers',
  saving = false,
  onSaveBriefing,
  onIssueInvoice,
  onPayInvoice,
  onCreditInvoice,
  onRefundInvoice,
  busyInvoiceId = null,
  moneyLink,
}) {
  const { customer, jobs, invoices, payments, complaints, totals } = data;
  const adjustments = data.adjustments ?? [];
  const certificates = data.certificates ?? [];
  const [previewing, setPreviewing] = useState(null);
  const installations = jobs.filter((job) => job.requestType === 'new_installation');

  const profileRows = [
    ['Phone', customer.phone],
    ['Email', customer.email],
    ['Business name', customer.company],
    ['Category', customer.category],
    ['Owner', customer.owner?.name],
    ['Address', customer.address],
    ['Legacy ID', customer.legacy?.legacyId],
    ['Created', formatDay(customer.createdAt)],
    ['Next follow-up', customer.followUp ? formatDay(customer.followUp) : ''],
  ].filter(([, value]) => value);

  return (
    <div className="mgr-account">
      {backTo ? <Link className="backlink" to={backTo}>← {backLabel}</Link> : null}

      <section className="account-head">
        <div className="account-head__identity">
          <p className="account-head__eyebrow">{customer.company || 'Customer account'}</p>
          <h2>{customer.name}</h2>
          <p className="account-head__meta">
            <span>{customer.phone || 'No phone'}</span>
            <span aria-hidden="true">·</span>
            <span>{customer.email || 'No email'}</span>
            <span aria-hidden="true">·</span>
            <span>{customer.category || 'No category'}</span>
          </p>
          <p className="account-head__owner">
            Owner {customer.owner?.name || 'unassigned'} · created {formatDay(customer.createdAt)} · priority
            {' '}<PriorityTag priority={customer.priority} />
          </p>
        </div>
        <div className="account-head__state">
          <AccountStateTag customer={customer} installations={installations.length} />
          <p>{customer.briefingCompleted ? 'Briefing recorded' : customer.legacy ? 'Imported customer · no briefing needed' : installations.length ? 'Briefing required' : 'No installation yet'}</p>
        </div>
      </section>

      <dl className="account-totals">
        <div><dt>Invoiced</dt><dd>{formatMoney(totals.invoiced)}</dd></div>
        <div><dt>Received</dt><dd>{formatMoney(totals.paid)}</dd></div>
        <div><dt>Outstanding</dt><dd data-due={totals.outstanding > 0}>{formatMoney(totals.outstanding)}</dd></div>
        <div><dt>Installations</dt><dd>{totals.completedInstallations} <small>of {totals.installations}</small></dd></div>
        <div><dt>Open complaints</dt><dd>{totals.openComplaints}</dd></div>
      </dl>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Customer information</h2>
            <p className="panel__meta">The contact and ownership details recorded for this account.</p>
          </div>
        </div>
        <dl className="account-facts">
          {profileRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          {customer.notes ? (
            <div className="account-facts__wide">
              <dt>Notes</dt>
              <dd>{customer.notes}</dd>
            </div>
          ) : null}
        </dl>
        {profileRows.length === 0 && !customer.notes ? (
          <p className="panel__note">Only the customer name has been recorded so far.</p>
        ) : null}
      </section>

      <div className="account-grid">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Vehicles &amp; installations</h2>
              <p className="panel__meta">Each vehicle carries its own station, technician, device IMEI and SIM.</p>
            </div>
          </div>

          {installations.length === 0 ? (
            <div className="app-empty">
              <span className="app-empty__mark" aria-hidden="true">—</span>
              <h2>No vehicle recorded</h2>
              <p>This customer was added for follow-up. Vehicle and installation details appear once operations fits a unit.</p>
            </div>
          ) : (
            <ul className="vehicle-list">
              {installations.map((job) => (
                <li key={job.id} className="vehicle">
                  <header className="vehicle__head">
                    <div>
                      <strong>{job.vehicle?.label || 'Vehicle'}</strong>
                      <span>{job.vehicle?.registration || 'No registration'}</span>
                    </div>
                    <StatusPill status={job.status} label={job.statusLabel} />
                  </header>
                  <dl className="vehicle__facts">
                    <div><dt>Station</dt><dd>{job.vehicle?.station || '—'}</dd></div>
                    <div><dt>Technician</dt><dd>{job.technician?.name || 'Unassigned'}</dd></div>
                    <div><dt>Device IMEI</dt><dd className="mono">{job.deviceImei || '—'}</dd></div>
                    <div><dt>SIM</dt><dd className="mono">{job.simNumber || '—'}</dd></div>
                    <div><dt>Scheduled</dt><dd>{formatDayTime(job.scheduledAt)}</dd></div>
                    <div><dt>Completed</dt><dd>{formatDayTime(job.completedAt)}</dd></div>
                  </dl>
                  <footer className="vehicle__foot">
                    <span>{job.packageName || 'No package'} · sold {formatMoney(job.quotedPrice ?? job.listPrice)}</span>
                    <span>Job {job.reference}</span>
                  </footer>
                </li>
              ))}
            </ul>
          )}
        </section>

        <BriefingPanel customer={customer} saving={saving} onSave={onSaveBriefing} />
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Invoices</h2>
            <p className="panel__meta">Draft, issue and settle — part payments are recorded separately.</p>
          </div>
          {moneyLink ? <Link to={moneyLink} className="btn btn--outline btn--small">Open money records</Link> : null}
        </div>
        <InvoiceTable
          invoices={invoices}
          busyId={busyInvoiceId}
          onIssue={onIssueInvoice}
          onPay={onPayInvoice}
          onCredit={onCreditInvoice}
          onRefund={onRefundInvoice}
          emptyMessage="No invoice exists for this customer yet. One is drafted from a completed installation."
        />
      </section>

      {adjustments.length > 0 ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Credit notes and refunds</h2>
              <p className="panel__meta">Corrections to issued invoices. Each one keeps its reason and cannot be edited.</p>
            </div>
          </div>
          <AdjustmentLedger adjustments={adjustments} />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Money received</h2>
            <p className="panel__meta">Append-only ledger — each instalment keeps its own date and reference.</p>
          </div>
        </div>
        <PaymentLedger
          payments={payments}
          eyebrow="Total received from this customer"
          emptyMessage="Record a payment against an issued invoice and it appears here."
        />
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Tracker certificates</h2>
            <p className="panel__meta">Every certificate issued for this customer's vehicles, including replaced and cancelled ones.</p>
          </div>
        </div>
        <CertificateTable certificates={certificates} onPreview={setPreviewing} emptyMessage="No certificate has been issued for this customer yet." />
      </section>
      {previewing ? <CertificatePreview certificate={previewing} onClose={() => setPreviewing(null)} /> : null}

      <CustomerTimeline customerId={customer.id} />

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Complaints</h2>
            <p className="panel__meta">{complaints.length} logged for this customer.</p>
          </div>
        </div>
        {complaints.length === 0 ? (
          <div className="app-empty">
            <span className="app-empty__mark" aria-hidden="true">—</span>
            <h2>No complaints</h2>
            <p>Nothing has been escalated for this customer.</p>
          </div>
        ) : (
          <ul className="complaint-lines">
            {complaints.map((complaint) => (
              <li key={complaint.id}>
                <div>
                  <span className="ledger__ref">{complaint.reference}</span>
                  <strong>{complaint.title}</strong>
                  <small>{complaint.category} · logged {formatDayTime(complaint.createdAt)}</small>
                </div>
                <StatusPill status={complaint.status} label={complaint.statusLabel} />
                {complaint.history?.length ? (
                  <details className="complaint-lines__history">
                    <summary>{complaint.history.length} status {complaint.history.length === 1 ? 'entry' : 'entries'}</summary>
                    <div>
                      {[...complaint.history].reverse().map((entry, index) => (
                        <p key={`${entry.at}-${index}`}>
                          {formatDayTime(entry.at)} · {entry.statusLabel || entry.status}{entry.note ? ` — ${entry.note}` : ''}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
