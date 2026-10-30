import Activity from '../../models/Activity.js';
import Approval, { APPROVAL_STATUSES } from '../../models/Approval.js';
import Job, { jobStatusLabels } from '../../models/Job.js';
import { packageCatalog } from '../../models/Package.js';
import User from '../../models/User.js';
import { CURRENCY } from '../pricing/pricing.service.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';

const money = (value) => `${CURRENCY} ${Number(value).toLocaleString()}`;

function pageParams(page, limit) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

async function listApprovals({ status, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status && APPROVAL_STATUSES.includes(status)) filter.status = status;

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total, pending] = await Promise.all([
    Approval.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('requestedBy', 'name role')
      .populate('decidedBy', 'name')
      .populate('job', 'reference status vehicle')
      .populate('customer', 'name phone'),
    Approval.countDocuments(filter),
    Approval.countDocuments({ status: 'pending' }),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit), pending },
  };
}

/**
 * Called by the operations module when a salesperson quotes below the package
 * rate. The price difference is fixed at request time, so a later admin price
 * change cannot silently alter an approval the admin already reviewed.
 */
async function createApprovalForJob({ job, customerName, packageKey, listPrice, quotedPrice, reason }, actor) {
  const approval = await Approval.create({
    job: job._id,
    customer: job.customer,
    packageKey,
    listPrice,
    quotedPrice,
    reason: reason?.trim() || '',
    requestedBy: actor.id,
    status: 'pending',
  });

  const admins = await User.find({ role: 'admin', active: true }).select('_id');

  await Promise.all(admins.map((admin) => notifyUser({
    userId: admin._id,
    type: 'approval.requested',
    title: `Price approval · ${job.reference}`,
    body: `${customerName || 'Customer'} · ${packageCatalog[packageKey].name} quoted at ${money(quotedPrice)}, below the ${money(listPrice)} rate.`,
    link: '/admin/approvals',
    meta: {
      reference: job.reference,
      recordId: approval._id.toString(),
      status: 'pending',
      station: job.vehicle?.station ?? '',
    },
  })));

  return approval;
}

async function decideApproval(id, input, actor) {
  const decision = input.decision === 'approved' || input.decision === 'rejected' ? input.decision : null;
  if (!decision) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose whether to approve or reject this price.');
  }

  const approval = await Approval.findById(id)
    .populate('requestedBy', 'name role')
    .populate('job', 'reference status vehicle')
    .populate('customer', 'name phone');

  if (!approval) throw makeError(errorCodes.NOT_FOUND, 'No price approval matches that id.');

  if (approval.status !== 'pending') {
    throw makeError(errorCodes.CONFLICT, 'This price has already been decided.', 409);
  }

  approval.status = decision;
  approval.decidedBy = actor.id;
  approval.decidedAt = new Date();
  approval.decisionNote = String(input.note ?? '').trim().slice(0, 500);
  await approval.save();

  const job = await Job.findById(approval.job?._id ?? approval.job);
  if (job) {
    job.approvalStatus = decision;
    job.history.push({
      status: job.status,
      note: decision === 'approved'
        ? `Price approved at ${money(approval.quotedPrice)} for the ${packageCatalog[approval.packageKey].name} package.`
        : `Price rejected: ${approval.decisionNote || 'the quoted rate was not approved.'}`,
      at: new Date(),
      by: actor.id,
    });
    await job.save();
  }

  await Activity.create({
    actor: actor.id,
    type: 'approval.decided',
    label: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${approval.reference} at ${money(approval.quotedPrice)}`,
    description: `${approval.customer?.name ?? 'Customer'} · ${packageCatalog[approval.packageKey].name} package${approval.decisionNote ? ` — ${approval.decisionNote}` : ''}`,
  });

  if (approval.requestedBy?._id) {
    await notifyUser({
      userId: approval.requestedBy._id,
      type: 'approval.decided',
      title: `Price ${decision} · ${approval.reference}`,
      body: `${packageCatalog[approval.packageKey].name} for ${approval.customer?.name ?? 'your customer'} at ${money(approval.quotedPrice)}${approval.decisionNote ? ` — ${approval.decisionNote}` : ''}.`,
      link: '/salesperson/requests',
      meta: {
        reference: approval.reference,
        recordId: approval._id.toString(),
        status: decision,
        station: job?.vehicle?.station ?? '',
      },
    });
  }

  const refreshed = await Approval.findById(approval._id)
    .populate('requestedBy', 'name role')
    .populate('decidedBy', 'name')
    .populate('job', 'reference status vehicle')
    .populate('customer', 'name phone');

  return {
    approval: refreshed.toApiJson(),
    job: job ? { id: job._id.toString(), reference: job.reference, status: job.status, statusLabel: jobStatusLabels[job.status] } : null,
  };
}

async function getPendingApprovalCount() {
  return Approval.countDocuments({ status: 'pending' });
}

export { listApprovals, createApprovalForJob, decideApproval, getPendingApprovalCount };
