import { makeError } from '../../middleware/errors.js';
import Customer from '../../models/Customer.js';
import Job, { jobStatusLabels } from '../../models/Job.js';
import { packageCatalog } from '../../models/Package.js';

const DAY_MS = 86_400_000;
const RENEWAL_WINDOW_DAYS = 30;

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const SUSPEND_REASONS = {
  customer_unreachable: 'Customer not reachable',
  payment_pending: 'Waiting for payment',
  customer_postponed: 'Customer asked to wait',
  documents_missing: 'Documents missing',
  price_dispute: 'Price not agreed',
  other: 'Other reason',
};

const soldPrice = (job) => (Number.isFinite(job.quotedPrice) ? job.quotedPrice : Number.isFinite(job.listPrice) ? job.listPrice : 0);

function saleRow(job, { withMoney = true } = {}) {
  const list = Number.isFinite(job.listPrice) ? job.listPrice : null;
  const quoted = Number.isFinite(job.quotedPrice) ? job.quotedPrice : list;
  const row = {
    id: job._id.toString(),
    reference: job.reference,
    customerId: job.customer?.toString() ?? null,
    customerName: job.customerName ?? '',
    registration: job.vehicle?.registration ?? '',
    packageName: job.packageKey ? packageCatalog[job.packageKey]?.name ?? job.packageKey : '',
    approvalStatus: job.approvalStatus ?? 'not_required',
    status: job.status,
    statusLabel: jobStatusLabels[job.status] ?? job.status,
    salesperson: job.createdBy?.name ?? '',
    createdAt: job.createdAt.toISOString(),
  };
  if (withMoney) {
    row.listPrice = list;
    row.quotedPrice = quoted;
    row.discount = list !== null && quoted !== null && quoted < list ? list - quoted : 0;
  }
  if (job.suspension?.active) {
    row.suspension = {
      reason: job.suspension.reason,
      reasonLabel: SUSPEND_REASONS[job.suspension.reason] ?? job.suspension.reason,
      note: job.suspension.note ?? '',
      suspendedAt: job.suspension.suspendedAt?.toISOString() ?? null,
      suspendedBy: job.suspension.suspendedBy?.name ?? '',
    };
  }
  return row;
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

  const everything = await Job.find(saleFilter).sort({ createdAt: -1 }).populate('createdBy', 'name').populate('suspension.suspendedBy', 'name');
  const suspended = everything.filter((job) => job.suspension?.active);
  const sales = everything.filter((job) => !job.suspension?.active);
  const withMoney = !ownerId;

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
      monthSales: month.length,
      suspended: suspended.length,
      awaitingApproval: sales.filter((job) => job.approvalStatus === 'pending').length,
      renewalsDue: renewals.length,
      renewalsExpired: renewals.filter((row) => row.state === 'expired').length,
    },
    recent: sales.slice(0, 15).map((job) => saleRow(job, { withMoney })),
    suspended: suspended.map((job) => saleRow(job, { withMoney })),
    renewals,
  };
  /* Money is the admin's concern: only the company board carries it. */
  if (withMoney) {
    board.totals.salesValue = sum(sales);
    board.totals.monthValue = sum(month);
  }

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

async function loadSale(id, actor) {
  const job = await Job.findById(id);
  if (!job || job.requestType !== 'new_installation') throw makeError('SALE_NOT_FOUND', 'That sale could not be found.', 404);
  if (actor.role === 'salesperson' && job.createdBy?.toString() !== actor.id) throw makeError('SALE_NOT_FOUND', 'That sale could not be found.', 404);
  return job;
}

export async function suspendSale(id, actor, { reason, note } = {}) {
  if (!SUSPEND_REASONS[reason]) throw makeError('INVALID_REASON', 'Choose why the sale is on hold.', 400);
  const job = await loadSale(id, actor);
  if (['completed', 'cancelled'].includes(job.status)) throw makeError('SALE_CLOSED', 'A finished or cancelled sale cannot be put on hold.', 409);
  if (job.suspension?.active) throw makeError('ALREADY_SUSPENDED', 'This sale is already on hold.', 409);
  job.suspension = { active: true, reason, note: String(note ?? '').trim().slice(0, 500), suspendedAt: new Date(), suspendedBy: actor.id };
  await job.save();
  return { id: job._id.toString(), suspended: true };
}

export async function resumeSale(id, actor) {
  const job = await loadSale(id, actor);
  if (!job.suspension?.active) throw makeError('NOT_SUSPENDED', 'This sale is not on hold.', 409);
  job.suspension.active = false;
  job.suspension.resumedAt = new Date();
  await job.save();
  return { id: job._id.toString(), suspended: false };
}
