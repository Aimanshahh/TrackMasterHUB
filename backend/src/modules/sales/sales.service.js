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

export const CANCEL_REASONS = {
  customer_changed_mind: 'Customer changed their mind',
  technician_delayed: 'Technician was delayed',
  price_too_high: 'Price too high',
  bought_elsewhere: 'Bought elsewhere',
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
  if (job.status === 'cancelled') {
    row.cancellation = {
      reason: job.cancellation?.reason ?? null,
      reasonLabel: CANCEL_REASONS[job.cancellation?.reason] ?? 'No reason recorded',
      note: job.cancellation?.note ?? '',
      cancelledAt: (job.cancellation?.cancelledAt ?? job.updatedAt)?.toISOString() ?? null,
      cancelledBy: job.cancellation?.cancelledBy?.name ?? '',
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
  const saleFilter = { requestType: 'new_installation' };
  if (ownerId) saleFilter.createdBy = ownerId;

  const everything = await Job.find(saleFilter).sort({ createdAt: -1 }).populate('createdBy', 'name').populate('cancellation.cancelledBy', 'name');
  const cancelled = everything.filter((job) => job.status === 'cancelled');
  const sales = everything.filter((job) => job.status !== 'cancelled');
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
      cancelled: cancelled.length,
      awaitingApproval: sales.filter((job) => job.approvalStatus === 'pending').length,
      renewalsDue: renewals.length,
      renewalsExpired: renewals.filter((row) => row.state === 'expired').length,
    },
    recent: sales.slice(0, 15).map((job) => saleRow(job, { withMoney })),
    cancelled: cancelled.map((job) => saleRow(job, { withMoney })),
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

export async function cancelSale(id, actor, { reason, note } = {}) {
  if (!CANCEL_REASONS[reason]) throw makeError('INVALID_REASON', 'Choose why the sale was cancelled.', 400);
  const job = await loadSale(id, actor);
  if (job.status === 'cancelled') throw makeError('ALREADY_CANCELLED', 'This sale is already cancelled.', 409);
  if (job.status === 'completed') throw makeError('SALE_CLOSED', 'An installed vehicle cannot be cancelled as a sale.', 409);
  job.cancellation = { reason, note: String(note ?? '').trim().slice(0, 500), cancelledAt: new Date(), cancelledBy: actor.id, previousStatus: job.status };
  job.status = 'cancelled';
  await job.save();
  return { id: job._id.toString(), cancelled: true };
}

export async function restoreSale(id, actor) {
  const job = await loadSale(id, actor);
  if (job.status !== 'cancelled') throw makeError('NOT_CANCELLED', 'This sale is not cancelled.', 409);
  job.status = job.cancellation?.previousStatus || 'unassigned';
  job.cancellation = undefined;
  await job.save();
  return { id: job._id.toString(), cancelled: false };
}

/**
 * Agent-assisted sales. Commission is tracked separately from salesperson
 * performance and technician payments, and is never marked paid automatically.
 */
export async function getAgentCommissions({ agent } = {}) {
  const filter = { requestType: 'new_installation', 'agent.source': 'agent' };
  if (agent) filter['agent.name'] = new RegExp(String(agent).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(200).populate('createdBy', 'name');
  const rows = jobs.map((job) => ({
    id: job._id.toString(),
    reference: job.reference,
    customerName: job.customerName ?? '',
    registration: job.vehicle?.registration ?? '',
    agent: job.agent?.name ?? '',
    agentPhone: job.agent?.phone ?? '',
    commission: job.agent?.commission ?? 0,
    commissionPaid: Boolean(job.agent?.commissionPaid),
    commissionPaidAt: job.agent?.commissionPaidAt?.toISOString() ?? null,
    remarks: job.agent?.commissionRemarks ?? '',
    salesperson: job.createdBy?.name ?? '',
    status: job.status,
    createdAt: job.createdAt.toISOString(),
  }));

  const byAgent = new Map();
  for (const row of rows) {
    const entry = byAgent.get(row.agent) ?? { name: row.agent, phone: row.agentPhone, sales: 0, total: 0, paid: 0, pending: 0 };
    entry.sales += 1;
    entry.total += row.commission;
    if (row.commissionPaid) entry.paid += row.commission; else entry.pending += row.commission;
    byAgent.set(row.agent, entry);
  }

  return {
    data: rows,
    agents: [...byAgent.values()].sort((a, b) => b.pending - a.pending || b.total - a.total),
    meta: {
      sales: rows.length,
      total: rows.reduce((sum, row) => sum + row.commission, 0),
      paid: rows.filter((row) => row.commissionPaid).reduce((sum, row) => sum + row.commission, 0),
      pending: rows.filter((row) => !row.commissionPaid).reduce((sum, row) => sum + row.commission, 0),
    },
  };
}

export async function setCommissionPaid(id, { paid = true } = {}, actor) {
  const job = await Job.findById(id);
  if (!job) throw makeError('SALE_NOT_FOUND', 'That sale could not be found.', 404);
  if (job.agent?.source !== 'agent') throw makeError('NOT_AGENT_SALE', 'This sale was not brought in by an agent.', 400);

  job.agent.commissionPaid = Boolean(paid);
  job.agent.commissionPaidAt = paid ? new Date() : undefined;
  job.history.push({
    status: job.status,
    note: `Agent commission ${paid ? 'marked paid' : 'reopened'}${actor?.name ? ` by ${actor.name}` : ''}.`,
    at: new Date(),
    by: actor?.id,
    byName: actor?.name ?? '',
  });
  await job.save();
  return { id: job._id.toString(), commissionPaid: job.agent.commissionPaid };
}

/* --------------------------------------------------------------------------
   Sales performance
   -------------------------------------------------------------------------- */

/** Monday 00:00 of the current week, in the server's local time. */
function startOfWeek(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - weekday);
  return start;
}

function parseBoundary(value, label, endOfDay = false) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw makeError('INVALID_DATE_RANGE', `Enter a valid ${label}.`, 400);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

const isCancelled = (job) => job.status === 'cancelled';
const isCompleted = (job) => job.status === 'completed';
const isPending = (job) => !isCancelled(job) && !isCompleted(job);

/**
 * The admin's sales picture. Every figure is counted from stored installations;
 * nothing is estimated. A range filters the headline numbers and the ranking,
 * while the month and week columns always describe the current month and week so
 * the two comparisons stay meaningful.
 */
export async function getSalesPerformance({ from, to, salesperson } = {}) {
  const now = new Date();
  const monthStart = startOfMonth();
  const weekStart = startOfWeek(now);
  const rangeFrom = parseBoundary(from, 'start date');
  const rangeTo = parseBoundary(to, 'end date', true);

  if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
    throw makeError('INVALID_DATE_RANGE', 'The start date is after the end date.', 400);
  }

  /* Imported legacy vehicles are already-installed records, not sales made by
     anyone, so they are excluded: counting them would credit a salesperson with
     history they never sold. */
  const jobs = await Job.find({ requestType: 'new_installation', 'legacy.imported': { $ne: true } })
    .select('reference customerName status quotedPrice listPrice packageKey approvalStatus createdAt completedAt createdBy vehicle agent cancellation')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const inRange = (job) => {
    if (!rangeFrom && !rangeTo) return true;
    const at = new Date(job.createdAt);
    if (rangeFrom && at < rangeFrom) return false;
    if (rangeTo && at > rangeTo) return false;
    return true;
  };

  const inRangeJobs = jobs.filter(inRange);
  const soldInRange = inRangeJobs.filter((job) => !isCancelled(job));
  const sum = (rows) => rows.reduce((total, job) => total + soldPrice(job), 0);

  const people = new Map();
  const ensurePerson = (job) => {
    const id = job.createdBy?._id?.toString() ?? 'unknown';
    if (!people.has(id)) {
      people.set(id, {
        id,
        name: job.createdBy?.name ?? 'Unassigned',
        sales: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        revenue: 0,
        monthSales: 0,
        monthRevenue: 0,
        weekSales: 0,
        weekRevenue: 0,
        agentSales: 0,
        agentCommission: 0,
        lastSaleAt: null,
      });
    }
    return people.get(id);
  };

  for (const job of inRangeJobs) {
    const person = ensurePerson(job);
    const value = soldPrice(job);
    if (isCancelled(job)) {
      person.cancelled += 1;
    } else {
      person.sales += 1;
      person.revenue += value;
      if (isCompleted(job)) person.completed += 1;
      else person.pending += 1;
      if (job.agent?.source === 'agent') {
        person.agentSales += 1;
        person.agentCommission += Number(job.agent?.commission) || 0;
      }
      const createdAt = new Date(job.createdAt);
      if (!person.lastSaleAt || createdAt > new Date(person.lastSaleAt)) person.lastSaleAt = createdAt.toISOString();
    }
  }

  for (const job of soldInRange) {
    const person = ensurePerson(job);
    const value = soldPrice(job);
    const createdAt = new Date(job.createdAt);
    if (createdAt >= monthStart) { person.monthSales += 1; person.monthRevenue += value; }
    if (createdAt >= weekStart) { person.weekSales += 1; person.weekRevenue += value; }
  }

  /* Hot leads are a customer flag, counted per owner so the ranking can show
     who is sitting on interest without an installation. */
  const hotLeadCounts = await Customer.aggregate([
    { $match: { 'hotLead.active': true } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ]);
  const hotByOwner = new Map(hotLeadCounts.map((row) => [String(row._id), row.count]));

  const bySalesperson = [...people.values()]
    .map((person) => ({
      ...person,
      revenue: Math.round(person.revenue * 100) / 100,
      monthRevenue: Math.round(person.monthRevenue * 100) / 100,
      weekRevenue: Math.round(person.weekRevenue * 100) / 100,
      hotLeads: hotByOwner.get(person.id) ?? 0,
      averageSale: person.sales ? Math.round((person.revenue / person.sales) * 100) / 100 : null,
      completionRate: person.sales + person.cancelled
        ? Math.round((person.completed / (person.sales + person.cancelled)) * 100)
        : null,
    }))
    .filter((person) => !salesperson || person.id === salesperson)
    .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);

  const monthJobs = jobs.filter((job) => !isCancelled(job) && new Date(job.createdAt) >= monthStart);
  const weekJobs = jobs.filter((job) => !isCancelled(job) && new Date(job.createdAt) >= weekStart);

  /* Agents are tracked separately from salesperson performance. */
  const agentRows = new Map();
  for (const job of soldInRange) {
    if (job.agent?.source !== 'agent') continue;
    const name = job.agent?.name || 'Unnamed agent';
    const entry = agentRows.get(name) ?? { name, phone: job.agent?.phone ?? '', sales: 0, commission: 0, paid: 0, pending: 0 };
    entry.sales += 1;
    const commission = Number(job.agent?.commission) || 0;
    entry.commission += commission;
    if (job.agent?.commissionPaid) entry.paid += commission;
    else entry.pending += commission;
    agentRows.set(name, entry);
  }

  const hotLeads = await Customer.find({ 'hotLead.active': true })
    .sort({ 'hotLead.nextFollowUp': 1, 'hotLead.updatedAt': -1 })
    .limit(12)
    .populate('owner', 'name')
    .select('name phone company hotLead packageKey owner');

  return {
    range: {
      from: rangeFrom?.toISOString() ?? null,
      to: rangeTo?.toISOString() ?? null,
      allTime: !rangeFrom && !rangeTo,
    },
    totals: {
      sales: soldInRange.length,
      completed: soldInRange.filter(isCompleted).length,
      pending: soldInRange.filter(isPending).length,
      cancelled: inRangeJobs.filter(isCancelled).length,
      revenue: Math.round(sum(soldInRange) * 100) / 100,
      averageSale: soldInRange.length ? Math.round((sum(soldInRange) / soldInRange.length) * 100) / 100 : null,
      awaitingApproval: soldInRange.filter((job) => job.approvalStatus === 'pending').length,
      monthSales: monthJobs.length,
      monthRevenue: Math.round(sum(monthJobs) * 100) / 100,
      weekSales: weekJobs.length,
      weekRevenue: Math.round(sum(weekJobs) * 100) / 100,
    },
    bySalesperson,
    agents: [...agentRows.values()]
      .map((entry) => ({
        ...entry,
        commission: Math.round(entry.commission * 100) / 100,
        paid: Math.round(entry.paid * 100) / 100,
        pending: Math.round(entry.pending * 100) / 100,
      }))
      .sort((a, b) => b.pending - a.pending || b.commission - a.commission),
    hotLeads: hotLeads.map((customer) => ({
      id: customer._id.toString(),
      name: customer.name,
      phone: customer.phone ?? '',
      company: customer.company ?? '',
      status: customer.hotLead?.status ?? 'follow_up_required',
      reason: customer.hotLead?.reason ?? '',
      nextFollowUp: customer.hotLead?.nextFollowUp?.toISOString() ?? null,
      owner: customer.owner?.name ?? '',
    })),
  };
}
