import Customer from '../../models/Customer.js';
import Job, { jobStatusLabels } from '../../models/Job.js';
import { packageCatalog } from '../../models/Package.js';

const DAY_MS = 86_400_000;
const RENEWAL_WINDOW_DAYS = 30;

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const soldPrice = (job) => (Number.isFinite(job.quotedPrice) ? job.quotedPrice : Number.isFinite(job.listPrice) ? job.listPrice : 0);

function saleRow(job) {
  const list = Number.isFinite(job.listPrice) ? job.listPrice : null;
  const quoted = Number.isFinite(job.quotedPrice) ? job.quotedPrice : list;
  return {
    id: job._id.toString(),
    reference: job.reference,
    customerId: job.customer?.toString() ?? null,
    customerName: job.customerName ?? '',
    registration: job.vehicle?.registration ?? '',
    packageName: job.packageKey ? packageCatalog[job.packageKey]?.name ?? job.packageKey : '',
    listPrice: list,
    quotedPrice: quoted,
    discount: list !== null && quoted !== null && quoted < list ? list - quoted : 0,
    approvalStatus: job.approvalStatus ?? 'not_required',
    status: job.status,
    statusLabel: jobStatusLabels[job.status] ?? job.status,
    salesperson: job.createdBy?.name ?? '',
    createdAt: job.createdAt.toISOString(),
  };
}

function renewalRow(job, customerById, now) {
  const customer = customerById.get(job.customer?.toString());
  const days = Math.floor((new Date(job.amcExpiryDate).getTime() - now.getTime()) / DAY_MS);
  return {
    id: job._id.toString(),
    customerId: job.customer?.toString() ?? null,
    customerName: customer?.name ?? job.customerName ?? '',
    phone: customer?.phone ?? job.phone ?? '',
    registration: job.vehicle?.registration ?? '',
    expiresAt: new Date(job.amcExpiryDate).toISOString(),
    daysLeft: days,
    state: days < 0 ? 'expired' : 'due',
  };
}

/**
 * One view of selling. With an ownerId it is that salesperson's own sales and
 * renewals (their customers); without one it is the whole company.
 */
export async function getSalesBoard({ ownerId = null } = {}) {
  const now = new Date();
  const monthStart = startOfMonth();
  const saleFilter = { requestType: 'new_installation', status: { $ne: 'cancelled' } };
  if (ownerId) saleFilter.createdBy = ownerId;

  const sales = await Job.find(saleFilter).sort({ createdAt: -1 }).populate('createdBy', 'name');

  const month = sales.filter((job) => job.createdAt >= monthStart);
  const sum = (rows) => rows.reduce((total, job) => total + soldPrice(job), 0);

  /* Renewals: completed installations whose AMC has run out or runs out within 30 days. */
  const renewalFilter = {
    requestType: 'new_installation',
    status: 'completed',
    amcExpiryDate: { $ne: null, $lte: new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS) },
  };
  if (ownerId) {
    const owned = await Customer.find({ owner: ownerId }).select('_id');
    renewalFilter.customer = { $in: owned.map((customer) => customer._id) };
  }
  const renewalJobs = await Job.find(renewalFilter).sort({ amcExpiryDate: 1 }).limit(40);
  const customers = await Customer.find({ _id: { $in: renewalJobs.map((job) => job.customer).filter(Boolean) } }).select('name phone');
  const customerById = new Map(customers.map((customer) => [customer._id.toString(), customer]));
  const renewals = renewalJobs.map((job) => renewalRow(job, customerById, now));

  const board = {
    totals: {
      sales: sales.length,
      salesValue: sum(sales),
      monthSales: month.length,
      monthValue: sum(month),
      awaitingApproval: sales.filter((job) => job.approvalStatus === 'pending').length,
      renewalsDue: renewals.length,
      renewalsExpired: renewals.filter((row) => row.state === 'expired').length,
    },
    recent: sales.slice(0, 15).map(saleRow),
    renewals,
  };

  if (!ownerId) {
    const byPerson = new Map();
    for (const job of sales) {
      const id = job.createdBy?._id?.toString() ?? 'unknown';
      const entry = byPerson.get(id) ?? { id, name: job.createdBy?.name ?? 'Unknown', sales: 0, value: 0, monthSales: 0, monthValue: 0 };
      entry.sales += 1;
      entry.value += soldPrice(job);
      if (job.createdAt >= monthStart) { entry.monthSales += 1; entry.monthValue += soldPrice(job); }
      byPerson.set(id, entry);
    }
    board.bySalesperson = [...byPerson.values()].sort((a, b) => b.monthValue - a.monthValue || b.value - a.value);
  }

  return board;
}
