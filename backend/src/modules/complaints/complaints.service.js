import Complaint, { COMPLAINT_STATUSES, complaintStatusLabels } from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function listComplaints({ status, priority, q, createdBy, page = 1, limit = 20 }) {
  const filter = {};

  if (status && COMPLAINT_STATUSES.includes(status)) filter.status = status;
  if (priority) filter.priority = priority;
  if (createdBy) filter.createdBy = createdBy;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ reference: regex }, { title: regex }, { customerName: regex }, { phone: regex }];
  }

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [rows, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name'),
    Complaint.countDocuments(filter),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

async function createComplaint(input, actor) {
  const title = String(input.title ?? '').trim();
  if (title.length < 3) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Describe the complaint in a short title.');
  }

  let customer = null;
  if (input.customerId) {
    customer = await Customer.findById(input.customerId);
    if (!customer) throw makeError(errorCodes.VALIDATION_ERROR, 'That customer record does not exist.');
  }

  const customerName = customer?.name ?? String(input.customerName ?? '').trim();
  if (!customerName) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the customer this complaint belongs to.');
  }

  const complaint = new Complaint({
    customer: customer?._id,
    customerName,
    phone: customer?.phone ?? String(input.phone ?? '').trim(),
    title,
    description: String(input.description ?? '').trim(),
    category: String(input.category ?? 'General').trim(),
    priority: input.priority ?? 'normal',
    createdBy: actor.id,
    history: [{ status: 'open', note: 'Ticket logged.', at: new Date(), by: actor.id }],
  });

  await complaint.save();
  return complaint.toApiJson();
}

async function updateComplaint(id, input, actor) {
  const complaint = await Complaint.findById(id);
  if (!complaint) throw makeError(errorCodes.NOT_FOUND, 'No complaint matches that id.');

  const previousStatus = complaint.status;

  if (input.status !== undefined && !COMPLAINT_STATUSES.includes(input.status)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid complaint status.');
  }

  if (input.assignToSelf === true) complaint.assignedTo = actor.id;
  if (input.assignToSelf === false) complaint.assignedTo = null;

  if (input.resolution !== undefined) complaint.resolution = String(input.resolution).trim();
  if (input.priority !== undefined) complaint.priority = input.priority;

  const nextStatus = input.status ?? complaint.status;
  complaint.status = nextStatus;

  const statusChanged = nextStatus !== previousStatus;

  if (statusChanged || input.note) {
    complaint.history.push({
      status: nextStatus,
      note: String(input.note ?? '').trim() || (statusChanged ? `Status moved to ${complaintStatusLabels[nextStatus]}.` : ''),
      at: new Date(),
      by: actor.id,
    });
  }

  await complaint.save();

  if (statusChanged && complaint.createdBy && String(complaint.createdBy) !== String(actor.id)) {
    await notifyUser({
      userId: complaint.createdBy,
      type: 'complaint.status_changed',
      title: `Complaint ${complaint.reference} · ${complaintStatusLabels[nextStatus]}`,
      body: `${complaint.customerName || 'Customer'} — ${complaint.title}`,
      link: '/salesperson',
      meta: { reference: complaint.reference, recordId: complaint._id.toString(), status: nextStatus },
    });
  }

  const populated = await Complaint.findById(complaint._id).populate('assignedTo', 'name').populate('createdBy', 'name');
  return populated.toApiJson();
}

export { listComplaints, createComplaint, updateComplaint };
