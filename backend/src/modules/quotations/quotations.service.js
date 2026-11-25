import Activity from '../../models/Activity.js';
import Customer from '../../models/Customer.js';
import Package from '../../models/Package.js';
import Job from '../../models/Job.js';
import Quotation, { QUOTATION_STATUSES } from '../../models/Quotation.js';
import { PACKAGE_KEYS, packageCatalog } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

export const CURRENCY = 'PKR';

const DAY_MS = 86_400_000;
const DEFAULT_VALIDITY_DAYS = 7;

const DEFAULT_TERMS = [
  'Installation is scheduled by our operations team within two working days of acceptance.',
  'The price covers the device, the SIM, the installation and the annual monitoring for one vehicle.',
  'This quotation is valid until the date shown above.',
].join('\n');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pageParams(page, limit, maxLimit = 100) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, Number.parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** The salesperson's own portfolio, resolved on the server from the session. */
async function portfolioCustomerIds(actor) {
  if (actor.role !== 'salesperson') return null;
  const rows = await Customer.find({ owner: actor.id }).select('_id').lean();
  return rows.map((row) => row._id);
}

function assertCanWrite(customer, actor) {
  if (actor.role === 'salesperson' && customer.owner?.toString() !== actor.id) {
    throw makeError(errorCodes.FORBIDDEN, 'That customer belongs to another salesperson.', 403);
  }
}

function assertCanRead(quotation, actor) {
  if (actor.role !== 'salesperson') return;
  const createdBy = quotation.createdBy?._id?.toString() ?? quotation.createdBy?.toString() ?? '';
  const owner = quotation.customer?.owner?._id?.toString() ?? quotation.customer?.owner?.toString() ?? '';
  if (createdBy !== actor.id && owner !== actor.id) {
    throw makeError(errorCodes.FORBIDDEN, 'That quotation belongs to another salesperson.', 403);
  }
}

async function loadQuotation(id, actor) {
  const quotation = await Quotation.findById(id)
    .populate('customer', 'name phone owner')
    .populate('job', 'reference status')
    .populate('createdBy', 'name');

  if (!quotation) throw makeError(errorCodes.NOT_FOUND, 'No quotation matches that reference.', 404);
  assertCanRead(quotation, actor);
  return quotation;
}

function parseAmount(raw, label = 'the quoted price') {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeError(errorCodes.VALIDATION_ERROR, `Enter ${label} as a number greater than zero.`);
  }
  return Math.round(amount * 100) / 100;
}

function parseValidUntil(raw, { allowPast = false } = {}) {
  if (!raw) {
    const fallback = new Date(startOfToday().getTime() + DEFAULT_VALIDITY_DAYS * DAY_MS);
    return fallback;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the date this quotation stops being valid.');
  }

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  if (!allowPast && end.getTime() < Date.now()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The validity date cannot be in the past.');
  }
  return date;
}

async function packageRate(packageKey) {
  if (!PACKAGE_KEYS.includes(packageKey)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose one of the service packages.');
  }
  const doc = await Package.findOne({ key: packageKey });
  return Number.isFinite(doc?.price) ? doc.price : null;
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

async function resolveCustomer(customerId, actor) {
  const customer = await Customer.findById(customerId).select('name phone owner vehicles');
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'Choose the customer this quotation is for.', 404);
  assertCanWrite(customer, actor);
  return customer;
}

async function resolveJob(jobId, customer, actor) {
  if (!jobId) return null;
  const job = await Job.findById(jobId).select('reference customer createdBy vehicle');
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'That installation request could not be found.', 404);

  if (job.customer?.toString() !== customer._id.toString()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'That installation request belongs to a different customer.');
  }
  if (actor.role === 'salesperson' && job.createdBy?.toString() !== actor.id) {
    throw makeError(errorCodes.FORBIDDEN, 'That installation request belongs to another salesperson.', 403);
  }
  return job;
}

/* -------------------------------------------------------------------- list */

async function listQuotations({ q, status, customer, page = 1, limit = 20 } = {}, actor) {
  const filter = {};
  const now = new Date();

  const portfolio = await portfolioCustomerIds(actor);
  if (portfolio) filter.customer = { $in: portfolio };
  if (customer) filter.customer = portfolio ? { $in: portfolio.filter((id) => id.toString() === customer) } : customer;

  if (q) {
    const regex = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ reference: regex }, { customerName: regex }, { customerPhone: regex }, { 'vehicle.registration': regex }];
  }

  // "Expired" is worked out from the validity date, so it is filtered in memory;
  // a sent quote that is still inside its window is the only live "Sent" state.
  if (QUOTATION_STATUSES.includes(status)) {
    filter.status = status;
    if (status === 'sent') filter.validUntil = { $gte: startOfToday() };
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);
  const populate = (query) => query.populate('customer', 'name phone owner').populate('createdBy', 'name');

  if (status === 'expired') {
    const all = await populate(Quotation.find({ ...filter, status: 'sent', validUntil: { $lt: startOfToday() } }).sort({ validUntil: -1 }));
    const rows = all.map((row) => row.toApiJson(now));

    return {
      data: rows.slice(skip, skip + safeLimit),
      meta: { total: rows.length, page: safePage, limit: safeLimit, pages: Math.ceil(rows.length / safeLimit) || 1, currency: CURRENCY },
    };
  }

  const [rows, total] = await Promise.all([
    populate(Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit)),
    Quotation.countDocuments(filter),
  ]);

  return {
    data: rows.map((row) => row.toApiJson(now)),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) || 1, currency: CURRENCY },
  };
}

async function getQuotationDetail(id, actor) {
  const quotation = await loadQuotation(id, actor);
  return { quotation: quotation.toApiJson() };
}

/* ------------------------------------------------------------------ create */

async function createQuotation(input, actor) {
  const customer = await resolveCustomer(input.customerId ?? input.customer, actor);
  const job = await resolveJob(input.jobId ?? input.job, customer, actor);

  const packageKey = String(input.packageKey ?? '');
  const listPrice = await packageRate(packageKey);
  const amount = parseAmount(input.amount);
  const vehicle = job?.vehicle ?? {};

  const quotation = new Quotation({
    customer: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone ?? '',
    job: job?._id ?? null,
    jobReference: job?.reference ?? '',
    vehicle: {
      label: text(input.vehicleLabel ?? vehicle.label, 120),
      registration: text(input.vehicleRegistration ?? vehicle.registration, 60),
    },
    packageKey,
    listPrice,
    amount,
    validUntil: parseValidUntil(input.validUntil),
    terms: text(input.terms, 1000) || DEFAULT_TERMS,
    notes: text(input.notes, 1000),
    createdBy: actor.id,
  });

  await quotation.save();

  await Activity.create({
    actor: actor.id,
    type: 'quotation.created',
    label: `Quotation ${quotation.reference} prepared for ${customer.name}`,
    description: `${quotation.reference} · ${packageCatalog[packageKey].name} · ${CURRENCY} ${amount.toLocaleString()}`,
    recordId: customer._id,
  });

  return (await loadQuotation(quotation._id, actor)).toApiJson();
}

/** Only a draft can be changed; a sent quote is replaced by a new version. */
async function updateQuotation(id, input, actor) {
  const quotation = await loadQuotation(id, actor);

  if (quotation.status !== 'draft') {
    throw makeError(errorCodes.CONFLICT, 'This quotation has already been sent. Create a new version to change the price.');
  }

  if (input.packageKey !== undefined) {
    const packageKey = String(input.packageKey);
    quotation.packageKey = packageKey;
    quotation.listPrice = await packageRate(packageKey);
  }
  if (input.amount !== undefined) quotation.amount = parseAmount(input.amount);
  if (input.validUntil !== undefined) quotation.validUntil = parseValidUntil(input.validUntil);
  if (input.terms !== undefined) quotation.terms = text(input.terms, 1000);
  if (input.notes !== undefined) quotation.notes = text(input.notes, 1000);
  if (input.vehicleLabel !== undefined || input.vehicleRegistration !== undefined) {
    quotation.vehicle = {
      label: text(input.vehicleLabel ?? quotation.vehicle?.label, 120),
      registration: text(input.vehicleRegistration ?? quotation.vehicle?.registration, 60),
    };
  }

  await quotation.save();
  return (await loadQuotation(quotation._id, actor)).toApiJson();
}

/* ------------------------------------------------------------- transitions */

async function sendQuotation(id, actor) {
  const quotation = await loadQuotation(id, actor);

  if (quotation.status !== 'draft') {
    throw makeError(errorCodes.CONFLICT, `Only a draft can be sent; ${quotation.reference} is already ${quotation.effectiveStatus()}.`);
  }
  if (quotation.isExpired()) {
    throw makeError(errorCodes.CONFLICT, 'The validity date has passed. Update the date before sending.');
  }

  quotation.status = 'sent';
  quotation.sentAt = new Date();
  await quotation.save();

  await Activity.create({
    actor: actor.id,
    type: 'quotation.sent',
    label: `Quotation ${quotation.reference} sent to ${quotation.customerName}`,
    description: `${CURRENCY} ${quotation.amount.toLocaleString()} · valid until ${quotation.validUntil.toISOString().slice(0, 10)}`,
    recordId: quotation.customer?._id,
  });

  return quotation.toApiJson();
}

async function decideQuotation(id, input, actor) {
  const quotation = await loadQuotation(id, actor);
  const decision = String(input.status ?? '');

  if (!['accepted', 'rejected'].includes(decision)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Record the customer’s answer as accepted or rejected.');
  }
  if (quotation.status !== 'sent') {
    throw makeError(errorCodes.CONFLICT, 'Only a sent quotation can be accepted or rejected.');
  }
  if (quotation.isExpired()) {
    throw makeError(errorCodes.CONFLICT, 'This quotation has expired. Create a new version before recording an answer.');
  }

  quotation.status = decision;
  quotation.decidedAt = new Date();
  quotation.decidedBy = actor.id;
  quotation.decisionNote = text(input.note, 500);
  await quotation.save();

  await Activity.create({
    actor: actor.id,
    type: 'quotation.decided',
    label: `Quotation ${quotation.reference} ${decision} by ${quotation.customerName}`,
    description: quotation.decisionNote
      ? `${CURRENCY} ${quotation.amount.toLocaleString()} · ${quotation.decisionNote}`
      : `${CURRENCY} ${quotation.amount.toLocaleString()}`,
    recordId: quotation.customer?._id,
  });

  return quotation.toApiJson();
}

/**
 * A price the customer has not answered, or has refused, becomes a new draft
 * version of the same document: the old figures move to `history`, so the
 * negotiation stays readable instead of overwriting what was offered.
 */
async function reviseQuotation(id, input, actor) {
  const quotation = await loadQuotation(id, actor);

  const effective = quotation.effectiveStatus();
  if (effective === 'draft') {
    throw makeError(errorCodes.CONFLICT, 'This quotation is still a draft. Edit it directly instead.');
  }
  if (effective === 'accepted') {
    throw makeError(errorCodes.CONFLICT, 'An accepted quotation cannot be revised. Raise a new sale instead.');
  }

  quotation.history.push({
    version: quotation.version ?? 1,
    amount: quotation.amount,
    listPrice: quotation.listPrice ?? null,
    packageKey: quotation.packageKey,
    validUntil: quotation.validUntil,
    terms: quotation.terms ?? '',
    notes: quotation.notes ?? '',
    recordedAt: new Date(),
    recordedBy: actor.id,
  });

  quotation.version = (quotation.version ?? 1) + 1;
  quotation.status = 'draft';
  quotation.sentAt = null;
  quotation.decidedAt = null;
  quotation.decidedBy = null;
  quotation.decisionNote = '';

  if (input?.packageKey !== undefined) {
    const packageKey = String(input.packageKey);
    quotation.packageKey = packageKey;
    quotation.listPrice = await packageRate(packageKey);
  }
  if (input?.amount !== undefined) quotation.amount = parseAmount(input.amount);
  quotation.validUntil = parseValidUntil(input?.validUntil, { allowPast: false });

  await quotation.save();
  return (await loadQuotation(quotation._id, actor)).toApiJson();
}

export {
  createQuotation,
  decideQuotation,
  getQuotationDetail,
  listQuotations,
  reviseQuotation,
  sendQuotation,
  updateQuotation,
};
