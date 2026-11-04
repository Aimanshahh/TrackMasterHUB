/**
 * Pure helpers for the customer history report. Nothing here touches the
 * database, so the rules (what is shown, in what order, how resolution time is
 * measured) can be tested without one.
 */

const RESOLVED_STATUSES = ['resolved', 'closed'];

const iso = (value) => (value ? new Date(value).toISOString() : null);

/** Milliseconds from logging a complaint to its first resolved/closed entry, or null while it is open. */
export function timeToResolveMs(complaint) {
  const created = complaint.createdAt ? new Date(complaint.createdAt).getTime() : null;
  if (created === null) return null;

  const done = (complaint.history ?? [])
    .filter((entry) => RESOLVED_STATUSES.includes(entry.status) && entry.at)
    .map((entry) => new Date(entry.at).getTime())
    .sort((a, b) => a - b)[0];

  return done === undefined ? null : Math.max(0, done - created);
}

/** "3 days 4 hours", "2 hours 5 minutes", "under a minute". */
export function describeDuration(ms) {
  if (ms === null || ms === undefined) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'under a minute';

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

  if (days > 0) return hours > 0 ? `${part(days, 'day')} ${part(hours, 'hour')}` : part(days, 'day');
  if (hours > 0) return mins > 0 ? `${part(hours, 'hour')} ${part(mins, 'minute')}` : part(hours, 'hour');
  return part(mins, 'minute');
}

/**
 * Merge every source into one list, newest first. `includeMoney` is false for
 * roles that must not see billing, in which case no money event is produced.
 */
export function buildTimeline({ customer, jobs = [], complaints = [], invoices = [], payments = [], adjustments = [], messages = [] }, { includeMoney = false } = {}) {
  const events = [];
  const add = (at, kind, title, detail, source, ref) => {
    if (!at) return;
    events.push({ at: iso(at), kind, title, detail: detail || '', source, ref: ref || '' });
  };

  if (customer?.createdAt) add(customer.createdAt, 'customer', 'Customer record created', '', 'Customer record');
  if (customer?.followUp) add(customer.followUp, 'follow_up', 'Follow-up due', customer.notes ? 'See notes on the customer record.' : '', 'Customer record');

  for (const job of jobs) {
    const what = [job.vehicle?.label, job.vehicle?.registration].filter(Boolean).join(' · ') || 'Vehicle';
    add(job.createdAt, 'installation', `Installation requested: ${what}`, '', 'Installations', job.reference);
    for (const entry of job.history ?? []) {
      add(entry.at, 'installation', `Installation ${String(entry.status).replace(/_/g, ' ')}: ${what}`, entry.note, 'Installations', job.reference);
    }
    if (job.completedAt) add(job.completedAt, 'installation', `Installation completed: ${what}`, '', 'Installations', job.reference);
  }

  for (const complaint of complaints) {
    add(complaint.createdAt, 'complaint', `Complaint logged: ${complaint.title}`, complaint.category, 'Complaints', complaint.reference);
    for (const entry of complaint.history ?? []) {
      const isOpening = entry.status === 'open' && !entry.note
        && Math.abs(new Date(entry.at).getTime() - new Date(complaint.createdAt).getTime()) < 2000;
      if (isOpening) continue;
      add(entry.at, 'complaint', `Complaint ${String(entry.status).replace(/_/g, ' ')}: ${complaint.title}`, entry.note, 'Complaints', complaint.reference);
    }
  }

  for (const message of messages) {
    add(message.createdAt, 'message', `${message.channelLabel ?? message.channel} ${message.statusLabel ?? message.status}: ${message.subject ?? ''}`.trim(), message.error, 'Messages', message.complaintReference);
  }

  if (includeMoney) {
    for (const invoice of invoices) {
      if (invoice.issuedAt) add(invoice.issuedAt, 'money', `Invoice issued: ${invoice.reference}`, '', 'Billing', invoice.reference);
    }
    for (const payment of payments) add(payment.receivedAt, 'money', `Payment received: ${payment.reference}`, '', 'Billing', payment.reference);
    for (const row of adjustments) add(row.issuedAt, 'money', `${row.kind === 'refund' ? 'Refund' : 'Credit note'} ${row.reference}`, row.reason, 'Billing', row.reference);
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}
