import User from '../../models/User.js';
import Activity from '../../models/Activity.js';
import Approval from '../../models/Approval.js';
import Complaint from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import Job from '../../models/Job.js';
import Technician from '../../models/Technician.js';
import { ASSIGNABLE_ROLES } from '../../config/constants.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { getMonthlyProgress } from '../sales/sales.service.js';
import { recordActivity } from '../activity/activity.log.js';
import { createUser as createAccount, listUsers } from '../auth/auth.service.js';

/**
 * Creating staff accounts. A technician login is always attached to a
 * technician record, because that record owns the stock and installations the
 * login may see; the two are created together so neither can exist without the
 * other.
 */
async function createUser(input, actor) {
  const role = ASSIGNABLE_ROLES.includes(input.role) ? input.role : 'salesperson';

  if (role !== 'technician') {
    const account = await createAccount({ ...input, role });
    await recordActivity({ actor, type: 'user.created', label: `Account created · ${account.name ?? input.name}`, description: `${role} account for ${input.email} created by ${actor?.name ?? 'an admin'}.` });
    return account;
  }

  let technician = null;
  if (input.technicianId) {
    technician = await Technician.findById(input.technicianId);
    if (!technician) throw makeError(errorCodes.VALIDATION_ERROR, 'That technician record does not exist.');
    if (technician.user) throw makeError(errorCodes.CONFLICT, 'That technician already has a login account.', 409);
  } else {
    technician = await Technician.create({
      name: input.name,
      phone: String(input.phone ?? '').trim().slice(0, 40),
      station: String(input.station ?? '').trim().slice(0, 120),
      createdBy: actor?.id,
    });
  }

  const created = await createAccount({ ...input, role: 'technician' });
  await User.updateOne({ _id: created.id }, { $set: { technician: technician._id } });
  technician.user = created.id;
  await technician.save();

  await recordActivity({ actor, type: 'user.created', label: `Technician account created · ${input.name}`, description: `Technician login for ${input.email} created by ${actor?.name ?? 'an admin'}.` });
  const user = await User.findById(created.id);
  return user.toApiJson();
}

async function getUsers({ role, search }) {
  const filter = { active: true };

  if (role) {
    filter.role = role;
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
    ];
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  return users.map((user) => user.toApiJson());
}

async function getUserById(id) {
  return User.findById(id);
}

async function getSalespersonPerformance(id) {
  const user = await User.findOne({ _id: id, role: 'salesperson' });
  if (!user) throw makeError(errorCodes.NOT_FOUND, 'No salesperson matches that id.');

  const [customers, jobs, complaints, approvals, recentActivity, quoted] = await Promise.all([
    Customer.find({ owner: id }).sort({ createdAt: -1 }).limit(8).select('name phone packageName packageKey createdAt followUp'),
    Job.find({ createdBy: id, 'legacy.imported': { $ne: true } }).sort({ createdAt: -1 }).limit(8).select('reference customerName status packageKey quotedPrice createdAt completedAt'),
    Complaint.find({ createdBy: id }).sort({ createdAt: -1 }).limit(8).select('reference title status customerName createdAt'),
    Approval.find({ requestedBy: id }).sort({ createdAt: -1 }).limit(8).select('status packageKey quotedPrice customerName createdAt decisionAt'),
    Activity.find({ actor: id }).sort({ createdAt: -1 }).limit(10).select('type label description createdAt'),
    Job.aggregate([
      { $match: { createdBy: user._id, 'legacy.imported': { $ne: true }, quotedPrice: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$quotedPrice' }, count: { $sum: 1 } } },
    ]),
  ]);

  const [customerCount, followUpCount, overdueFollowUpCount, jobCounts, complaintCounts, approvalCounts] = await Promise.all([
    Customer.countDocuments({ owner: id }),
    Customer.countDocuments({ owner: id, followUp: { $ne: null } }),
    Customer.countDocuments({ owner: id, followUp: { $lt: new Date(), $ne: null } }),
    Job.aggregate([{ $match: { createdBy: user._id, 'legacy.imported': { $ne: true } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: { createdBy: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Approval.aggregate([{ $match: { requestedBy: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const byStatus = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const jobStatus = byStatus(jobCounts);
  const complaintStatus = byStatus(complaintCounts);
  const approvalStatus = byStatus(approvalCounts);

  return {
    salesperson: user.toApiJson(),
    target: await getMonthlyProgress(id),
    metrics: {
      customers: customerCount,
      followUps: followUpCount,
      overdueFollowUps: overdueFollowUpCount,
      totalRequests: Object.values(jobStatus).reduce((sum, count) => sum + count, 0),
      completedRequests: jobStatus.completed ?? 0,
      openRequests: ['unassigned', 'assigned', 'scheduled', 'in_progress'].reduce((sum, key) => sum + (jobStatus[key] ?? 0), 0),
      quotedRevenue: quoted[0]?.total ?? 0,
      quotedDeals: quoted[0]?.count ?? 0,
      complaints: Object.values(complaintStatus).reduce((sum, count) => sum + count, 0),
      openComplaints: ['open', 'assigned', 'in_progress', 'waiting_customer'].reduce((sum, key) => sum + (complaintStatus[key] ?? 0), 0),
      approvals: Object.values(approvalStatus).reduce((sum, count) => sum + count, 0),
      approved: approvalStatus.approved ?? 0,
      pendingApprovals: approvalStatus.pending ?? 0,
    },
    breakdowns: { jobs: jobStatus, complaints: complaintStatus, approvals: approvalStatus },
    recent: {
      customers: customers.map((row) => ({ id: row._id.toString(), name: row.name, phone: row.phone ?? '', packageKey: row.packageKey ?? null, createdAt: row.createdAt?.toISOString() ?? null, followUp: row.followUp?.toISOString() ?? null })),
      jobs: jobs.map((row) => ({ id: row._id.toString(), reference: row.reference, customerName: row.customerName ?? '', status: row.status, packageKey: row.packageKey ?? null, quotedPrice: row.quotedPrice ?? null, createdAt: row.createdAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null })),
      complaints: complaints.map((row) => ({ id: row._id.toString(), reference: row.reference, title: row.title, status: row.status, customerName: row.customerName ?? '', createdAt: row.createdAt?.toISOString() ?? null })),
      approvals: approvals.map((row) => ({ id: row._id.toString(), status: row.status, packageKey: row.packageKey, quotedPrice: row.quotedPrice, customerName: row.customerName ?? '', createdAt: row.createdAt?.toISOString() ?? null })),
      activity: recentActivity.map((row) => ({ type: row.type, label: row.label, description: row.description ?? '', createdAt: row.createdAt?.toISOString() ?? null })),
    },
  };
}

async function changeRole(input, actor) {
  const user = await User.findById(input.id);

  if (!user) {
    throw makeError(errorCodes.NOT_FOUND, 'No account matches that id.');
  }

  if (user.role === 'admin') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The admin account cannot be changed.');
  }

  if (input.role === 'admin') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Only an admin can hold the admin role.');
  }

  if (input.role === user.role) {
    return user.toApiJson();
  }

  const previousRole = user.role;
  user.role = input.role;
  await user.save();
  await recordActivity({ actor, type: 'user.role_changed', label: `Role changed · ${user.name}`, description: `${user.name} moved from ${previousRole} to ${user.role} by ${actor?.name ?? 'an admin'}.` });

  return user.toApiJson();
}

const MAX_TARGET = 1000;

/** The monthly installation target for a salesperson. Zero clears it. */
async function setTarget(id, input, actor) {
  const user = await User.findOne({ _id: id, role: 'salesperson' });
  if (!user) throw makeError(errorCodes.NOT_FOUND, 'No salesperson matches that id.');
  const target = Number(input?.target);
  if (!Number.isInteger(target) || target < 0 || target > MAX_TARGET) {
    throw makeError(errorCodes.VALIDATION_ERROR, `Enter a whole number of installations per month, from 0 to ${MAX_TARGET}.`);
  }
  const previous = user.monthlyTarget ?? 0;
  user.monthlyTarget = target;
  await user.save();
  await recordActivity({ actor, type: 'target.updated', label: `Target set · ${user.name}`, description: `${user.name}'s monthly installation target changed from ${previous} to ${target} by ${actor?.name ?? 'an admin'}.` });
  return user.toApiJson();
}

export { setTarget, createUser, getUsers, getUserById, getSalespersonPerformance, changeRole };
