import Complaint from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import Job from '../../models/Job.js';
import Notification from '../../models/Notification.js';

const OPEN_JOB_STATUSES = ['unassigned', 'assigned', 'scheduled', 'in_progress'];
const OPEN_COMPLAINT_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer'];

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Everything here is filtered by the signed-in salesperson's own id. The
 * controller supplies that id from the session, never from the browser, so one
 * salesperson can never read another's portfolio.
 */
async function getSummary(userId) {
  const today = startOfToday();
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    followUpsDue,
    followUpsWeek,
    openRequests,
    completedRequests,
    totalRequests,
    openComplaints,
    totalComplaints,
    unreadNotifications,
    recentJobs,
    recentComplaints,
    dueCustomers,
  ] = await Promise.all([
    Customer.countDocuments({ owner: userId }),
    Customer.countDocuments({ owner: userId, followUp: { $lt: today } }),
    Customer.countDocuments({ owner: userId, followUp: { $gte: today, $lt: weekAhead } }),
    Job.countDocuments({ createdBy: userId, status: { $in: OPEN_JOB_STATUSES } }),
    Job.countDocuments({ createdBy: userId, status: 'completed' }),
    Job.countDocuments({ createdBy: userId }),
    Complaint.countDocuments({ createdBy: userId, status: { $in: OPEN_COMPLAINT_STATUSES } }),
    Complaint.countDocuments({ createdBy: userId }),
    Notification.countDocuments({ user: userId, readAt: null }),
    Job.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(5).populate('technician', 'name station'),
    Complaint.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(5),
    Customer.find({ owner: userId, followUp: { $ne: null, $lt: weekAhead } }).sort({ followUp: 1 }).limit(5),
  ]);

  return {
    customers: { total: totalCustomers, followUpsDue, followUpsWeek },
    requests: { open: openRequests, completed: completedRequests, total: totalRequests },
    complaints: { open: openComplaints, total: totalComplaints },
    notifications: { unread: unreadNotifications },
    recentJobs: recentJobs.map((job) => job.toApiJson()),
    recentComplaints: recentComplaints.map((complaint) => complaint.toApiJson()),
    followUps: dueCustomers.map((customer) => customer.toApiJson()),
  };
}

async function listMyJobs(userId, { status, page = 1, limit = 20 } = {}) {
  const filter = { createdBy: userId };
  if (status) filter.status = status;

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [rows, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('technician', 'name station'),
    Job.countDocuments(filter),
  ]);

  return {
    data: rows.map((job) => job.toApiJson()),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

export { getSummary, listMyJobs, OPEN_JOB_STATUSES, OPEN_COMPLAINT_STATUSES };
