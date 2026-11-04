import Complaint from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import Invoice from '../../models/Invoice.js';
import InvoiceAdjustment from '../../models/InvoiceAdjustment.js';
import Job from '../../models/Job.js';
import Payment from '../../models/Payment.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { invoiceFigures, round2 } from '../../utils/invoiceMath.js';
import { buildTimeline, describeDuration, timeToResolveMs } from '../../utils/timeline.js';
import { listCallsForCustomer } from '../calls/calls.service.js';
import { listMessagesForCustomer } from '../messaging/messaging.service.js';

const MONEY_ROLES = ['admin', 'manager'];
const SEE_ANY_ROLES = ['admin', 'manager', 'operations'];
const CALL_ROLES = ['admin', 'operations'];

/** Who may open this customer's report: admin and manager always, anyone else only for their own customers. */
export function canViewHistory(user, customer) {
  if (SEE_ANY_ROLES.includes(user.role)) return true;
  return customer.owner?.toString() === user.id;
}

/**
 * The printable per-customer report. It never carries the CNIC, date of birth
 * or E-PIN, and the money section exists only for roles allowed to see money.
 * Every total says where its number came from.
 */
export async function getCustomerHistory(customerId, user) {
  const customer = await Customer.findById(customerId).populate('owner', 'name');
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');
  if (user.role === 'manager' && !(await Job.exists({ customer: customer._id, status: 'completed' }))) {
    throw makeError(errorCodes.FORBIDDEN, 'This customer has no completed installation yet, so it is not on the manager desk.', 403);
  }
  if (!canViewHistory(user, { owner: customer.owner?._id })) {
    throw makeError(errorCodes.FORBIDDEN, 'You are not allowed to view this customer’s history.', 403);
  }

  const includeMoney = MONEY_ROLES.includes(user.role);

  const [jobs, complaints, invoices, payments, adjustments, messages, calls] = await Promise.all([
    Job.find({ customer: customer._id }).sort({ createdAt: 1 }).populate('technician', 'name'),
    Complaint.find({ customer: customer._id }).sort({ createdAt: 1 }),
    includeMoney ? Invoice.find({ customer: customer._id }).sort({ createdAt: 1 }) : [],
    includeMoney ? Payment.find({ customer: customer._id }).sort({ receivedAt: 1 }) : [],
    includeMoney ? InvoiceAdjustment.find({ customer: customer._id }).sort({ issuedAt: 1 }) : [],
    listMessagesForCustomer(customer._id),
    CALL_ROLES.includes(user.role) ? listCallsForCustomer(customer._id) : [],
  ]);

  const installations = jobs.map((job) => {
    const json = job.toApiJson();
    return {
      reference: json.reference,
      requestType: json.requestType,
      vehicle: json.vehicle,
      status: json.status,
      statusLabel: json.statusLabel,
      packageName: json.packageName,
      technician: job.technician?.name ?? '',
      deviceImei: json.deviceImei,
      simNumber: json.simNumber,
      requestedAt: json.createdAt,
      completedAt: json.completedAt,
      history: json.history,
    };
  });

  const complaintRows = complaints.map((complaint) => {
    const ms = timeToResolveMs(complaint);
    return {
      reference: complaint.reference,
      title: complaint.title,
      category: complaint.category,
      status: complaint.status,
      statusLabel: complaint.toApiJson().statusLabel,
      loggedAt: complaint.createdAt.toISOString(),
      timeToResolve: describeDuration(ms),
      timeToResolveMs: ms,
      resolution: complaint.resolution ?? '',
      history: (complaint.history ?? []).map((entry) => ({ status: entry.status, note: entry.note ?? '', at: entry.at?.toISOString() })),
    };
  });

  const resolvedTimes = complaintRows.map((row) => row.timeToResolveMs).filter((ms) => ms !== null);

  const totals = [
    { label: 'Installations (new)', value: installations.filter((row) => row.requestType === 'new_installation').length, source: 'Installation jobs' },
    { label: 'Installations completed', value: installations.filter((row) => row.status === 'completed').length, source: 'Installation jobs' },
    { label: 'Complaints logged', value: complaintRows.length, source: 'Complaint records' },
    { label: 'Complaints still open', value: complaintRows.filter((row) => !['resolved', 'closed'].includes(row.status)).length, source: 'Complaint records' },
    {
      label: 'Average time to resolve',
      value: resolvedTimes.length ? describeDuration(Math.round(resolvedTimes.reduce((a, b) => a + b, 0) / resolvedTimes.length)) : 'No resolved complaints',
      source: 'Complaint status history',
    },
    ...(CALL_ROLES.includes(user.role) ? [
      { label: 'Robocalls answered', value: calls.filter((c) => c.status === 'answered').length, source: 'Robocall provider webhook' },
      { label: 'Robocalls not answered', value: calls.filter((c) => c.status !== 'answered').length, source: 'Robocall provider webhook' },
    ] : []),
    { label: 'Emails sent', value: messages.filter((m) => m.channel === 'email' && m.status === 'sent').length, source: 'Message delivery records' },
    { label: 'Emails failed', value: messages.filter((m) => m.channel === 'email' && m.status === 'failed').length, source: 'Message delivery records' },
  ];

  let money = null;
  if (includeMoney) {
    const issued = invoices.filter((invoice) => invoice.status === 'issued').map((invoice) => invoiceFigures(invoice));
    const sum = (key) => round2(issued.reduce((total, figures) => total + figures[key], 0));
    money = {
      currency: 'PKR',
      invoices: invoices.map((invoice) => invoice.toApiJson()),
      payments: payments.map((payment) => payment.toApiJson()),
      adjustments: adjustments.map((row) => row.toApiJson()),
      totals: [
        { label: 'Invoiced (after credit notes)', value: sum('netAmount'), source: 'Issued invoices' },
        { label: 'Received (after refunds)', value: sum('netReceived'), source: 'Payment and refund records' },
        { label: 'Outstanding', value: sum('balance'), source: 'Issued invoices' },
        { label: 'Owed back to customer', value: sum('refundable'), source: 'Issued invoices' },
      ],
    };
  }

  const detail = customer.toDetailJson();

  return {
    generatedAt: new Date().toISOString(),
    includesMoney: includeMoney,
    customer: {
      id: detail.id,
      name: detail.name,
      phone: detail.phone,
      email: detail.email,
      company: detail.company,
      category: detail.category,
      accountStatus: detail.accountStatus,
      owner: customer.owner?.name ?? '',
      followUp: customer.followUp ? customer.followUp.toISOString() : null,
      notes: customer.notes ?? '',
      createdAt: customer.createdAt.toISOString(),
    },
    totals,
    installations,
    complaints: complaintRows,
    messages,
    calls: CALL_ROLES.includes(user.role)
      ? { connected: true, label: calls.length ? `${calls.length} robocall${calls.length === 1 ? '' : 's'} recorded` : 'No robocall recorded for this customer', rows: calls }
      : { connected: false, label: 'Call history is visible to admin and operations only', rows: [] },
    money,
    timeline: buildTimeline(
      { customer, jobs, complaints, invoices, payments, adjustments, messages },
      { includeMoney },
    ),
  };
}
