import Activity from '../../models/Activity.js';
import Invoice, { INVOICE_STATUSES } from '../../models/Invoice.js';
import Job from '../../models/Job.js';
import Customer from '../../models/Customer.js';
import Payment, { PAYMENT_METHODS, paymentMethodLabels } from '../../models/Payment.js';
import { packageCatalog } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';

export const CURRENCY = 'PKR';

const money = (value) => `${CURRENCY} ${Number(value ?? 0).toLocaleString()}`;
const round2 = (value) => Math.round(Number(value) * 100) / 100;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pageParams(page, limit, maxLimit = 100) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, Number.parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/* ------------------------------------------------------------------ invoices */

async function listInvoices({ q, status, paymentState, customer, job, page = 1, limit = 20 } = {}) {
  const filter = {};

  if (status && INVOICE_STATUSES.includes(status)) filter.status = status;
  if (customer) filter.customer = customer;
  if (job) filter.job = job;

  if (paymentState === 'unpaid') filter.paidAmount = 0;
  if (paymentState === 'paid') filter.$expr = { $gte: ['$paidAmount', '$amount'] };
  if (paymentState === 'partial') {
    filter.paidAmount = { $gt: 0 };
    filter.$expr = { $lt: ['$paidAmount', '$amount'] };
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ reference: regex }, { customerName: regex }, { jobReference: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('customer', 'name phone')
      .populate('job', 'reference status'),
    Invoice.countDocuments(filter),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit), currency: CURRENCY },
  };
}

/**
 * Draft an invoice. The manager owns this step; the amount starts at what the
 * installation was actually sold for so nobody retypes a price from memory.
 */
async function createInvoice(input, actor) {
  let job = null;
  let customer = null;

  if (input.jobId) {
    job = await Job.findById(input.jobId);
    if (!job) throw makeError(errorCodes.VALIDATION_ERROR, 'That installation does not exist.');

    const existing = await Invoice.findOne({ job: job._id, status: { $ne: 'cancelled' } });
    if (existing) {
      throw makeError(
        errorCodes.CONFLICT,
        `This installation already has invoice ${existing.reference}. Record a payment against it instead.`,
        409,
      );
    }

    customer = await Customer.findById(job.customer);
    if (!customer) throw makeError(errorCodes.VALIDATION_ERROR, 'The customer for this installation no longer exists.');
  } else if (input.customerId) {
    customer = await Customer.findById(input.customerId);
    if (!customer) throw makeError(errorCodes.VALIDATION_ERROR, 'That customer record does not exist.');
  } else {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the installation or customer this invoice bills.');
  }

  const fallbackAmount = job?.quotedPrice ?? null;
  const amount = round2(input.amount ?? fallbackAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      job
        ? 'This installation has no agreed price, so enter the invoice amount.'
        : 'Enter the amount this invoice bills.',
    );
  }

  let dueDate = null;
  if (input.dueDate) {
    dueDate = new Date(input.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid due date.');
  }

  const invoice = await Invoice.create({
    customer: customer._id,
    customerName: customer.name,
    job: job?._id,
    jobReference: job?.reference,
    vehicle: job?.vehicle ?? {},
    packageKey: job?.packageKey ?? null,
    listPrice: job?.listPrice ?? null,
    amount,
    dueDate,
    notes: String(input.notes ?? '').trim().slice(0, 1000),
    status: 'draft',
  });

  await Activity.create({
    actor: actor.id,
    type: 'invoice.created',
    label: `Invoice ${invoice.reference} drafted at ${money(amount)}`,
    description: `${customer.name}${job ? ` · job ${job.reference}` : ''}`,
  });

  return (await Invoice.findById(invoice._id).populate('customer', 'name phone').populate('job', 'reference status')).toApiJson();
}

/** Issuing fixes the invoice: from this point payments can be recorded. */
async function issueInvoice(id, actor) {
  const invoice = await Invoice.findById(id).populate('customer', 'name phone').populate('job', 'reference status');
  if (!invoice) throw makeError(errorCodes.NOT_FOUND, 'No invoice matches that id.');

  if (invoice.status === 'issued') return invoice.toApiJson();
  if (invoice.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'A cancelled invoice cannot be issued again. Draft a new one.', 409);
  }

  invoice.status = 'issued';
  invoice.issuedAt = new Date();
  invoice.issuedBy = actor.id;
  if (!invoice.dueDate) invoice.dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await invoice.save();

  await Activity.create({
    actor: actor.id,
    type: 'invoice.issued',
    label: `Invoice ${invoice.reference} issued for ${money(invoice.amount)}`,
    description: `${invoice.customerName ?? 'Customer'}${invoice.jobReference ? ` · job ${invoice.jobReference}` : ''}`,
  });

  const job = invoice.job?._id ? await Job.findById(invoice.job._id).select('createdBy reference') : null;
  if (job?.createdBy) {
    await notifyUser({
      userId: job.createdBy,
      type: 'invoice.issued',
      title: `Invoice issued · ${invoice.reference}`,
      body: `${invoice.customerName ?? 'Your customer'} · ${money(invoice.amount)}${invoice.dueDate ? ` due ${invoice.dueDate.toLocaleDateString('en-GB')}` : ''}.`,
      link: '/salesperson/sales',
      meta: { reference: invoice.reference, status: 'issued', station: invoice.vehicle?.registration ?? '' },
    });
  }

  return invoice.toApiJson();
}

async function cancelInvoice(id, input, actor) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw makeError(errorCodes.NOT_FOUND, 'No invoice matches that id.');
  if (invoice.status === 'cancelled') return invoice.toApiJson();
  if (invoice.paidAmount > 0) {
    throw makeError(
      errorCodes.CONFLICT,
      'This invoice already has payments against it. Record a refund or credit note instead of cancelling it.',
      409,
    );
  }

  invoice.status = 'cancelled';
  invoice.cancelledAt = new Date();
  invoice.cancelReason = String(input.reason ?? '').trim().slice(0, 400);
  await invoice.save();

  await Activity.create({
    actor: actor.id,
    type: 'invoice.cancelled',
    label: `Invoice ${invoice.reference} cancelled`,
    description: invoice.cancelReason || 'No reason recorded.',
  });

  return (await Invoice.findById(invoice._id).populate('customer', 'name phone').populate('job', 'reference status')).toApiJson();
}

/* ------------------------------------------------------------------ payments */

/**
 * Record one instalment. Partial payment is normal, so the amount is checked
 * against the remaining balance rather than the invoice total; the invoice's
 * paidAmount is then recalculated from the payment rows.
 */
async function recordPayment(invoiceId, input, actor) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw makeError(errorCodes.NOT_FOUND, 'No invoice matches that id.');

  if (invoice.status === 'draft') {
    throw makeError(errorCodes.CONFLICT, 'Issue this invoice before recording money against it.', 409);
  }
  if (invoice.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This invoice was cancelled, so it cannot take a payment.', 409);
  }

  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the amount the customer paid.');
  }

  const balance = invoice.balance();
  if (balance <= 0) {
    throw makeError(errorCodes.CONFLICT, 'This invoice is already settled in full.', 409);
  }
  if (amount > balance) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      `That is more than the ${money(balance)} still owed on this invoice. Enter the amount actually received.`,
    );
  }

  let receivedAt = new Date();
  if (input.receivedAt) {
    receivedAt = new Date(input.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid date received.');
    if (receivedAt.getTime() > Date.now() + 60_000) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'The date received cannot be in the future.');
    }
  }

  const method = PAYMENT_METHODS.includes(input.method) ? input.method : 'cash';

  const payment = await Payment.create({
    invoice: invoice._id,
    customer: invoice.customer,
    customerName: invoice.customerName,
    amount,
    method,
    transactionRef: String(input.transactionRef ?? '').trim().slice(0, 120),
    receivedAt,
    note: String(input.note ?? '').trim().slice(0, 400),
    recordedBy: actor.id,
  });

  // Recalculate from the rows themselves so a retried request can never double
  // count a payment or leave the cached total out of step with the ledger.
  const [totals] = await Payment.aggregate([
    { $match: { invoice: invoice._id } },
    { $group: { _id: null, paid: { $sum: '$amount' } } },
  ]);

  invoice.paidAmount = round2(totals?.paid ?? amount);
  if (invoice.paidAmount >= invoice.amount) {
    invoice.paidAt = receivedAt;
  } else {
    invoice.paidAt = null;
  }
  await invoice.save();

  await Activity.create({
    actor: actor.id,
    type: 'payment.recorded',
    label: `${money(amount)} received for invoice ${invoice.reference}`,
    description: `${invoice.customerName ?? 'Customer'} · ${paymentMethodLabels[method]}${invoice.balance() > 0 ? ` · ${money(invoice.balance())} still owed` : ' · settled in full'}`,
  });

  const job = invoice.job ? await Job.findById(invoice.job).select('createdBy reference') : null;
  if (job?.createdBy) {
    await notifyUser({
      userId: job.createdBy,
      type: 'payment.recorded',
      title: `${money(amount)} received · ${invoice.reference}`,
      body: `${invoice.customerName ?? 'Your customer'} paid ${money(amount)}${invoice.balance() > 0 ? `; ${money(invoice.balance())} remains.` : '; the invoice is settled.'}`,
      link: '/salesperson/sales',
      meta: { reference: invoice.reference, status: invoice.balance() > 0 ? 'partial' : 'paid', station: invoice.vehicle?.registration ?? '' },
    });
  }

  const refreshed = await Invoice.findById(invoice._id).populate('customer', 'name phone').populate('job', 'reference status');

  return { payment: payment.toApiJson(), invoice: refreshed.toApiJson() };
}

async function listPayments({ q, method, from, to, invoice, customer, page = 1, limit = 30 } = {}) {
  const filter = {};

  if (method && PAYMENT_METHODS.includes(method)) filter.method = method;
  if (invoice) filter.invoice = invoice;
  if (customer) filter.customer = customer;

  if (from || to) {
    filter.receivedAt = {};
    if (from) filter.receivedAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.receivedAt.$lte = end;
    }
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ reference: regex }, { customerName: regex }, { transactionRef: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total, totals] = await Promise.all([
    Payment.find(filter)
      .sort({ receivedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('invoice', 'reference amount paidAmount')
      .populate('customer', 'name phone'),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
      sum: round2(totals[0]?.sum ?? 0),
      currency: CURRENCY,
    },
  };
}

/** Every payment against one invoice, oldest first — the instalment history. */
async function listInvoicePayments(invoiceId) {
  const rows = await Payment.find({ invoice: invoiceId }).sort({ receivedAt: 1, createdAt: 1 });
  return rows.map((row) => row.toApiJson());
}

/* ------------------------------------------------------------------- totals */

async function getBillingSummary() {
  const monthStart = startOfMonth();
  const now = new Date();

  const [invoiceTotals, monthTotals, counts, overdue, monthPayments, recentPayments] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 'issued' } },
      {
        $group: {
          _id: null,
          invoiced: { $sum: '$amount' },
          collected: { $sum: '$paidAmount' },
          issuedCount: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { receivedAt: { $gte: monthStart } } },
      { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $group: {
          _id: null,
          drafts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          issued: { $sum: { $cond: [{ $eq: ['$status', 'issued'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          partial: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'issued'] }, { $gt: ['$paidAmount', 0] }, { $lt: ['$paidAmount', '$amount'] }] },
                1,
                0,
              ],
            },
          },
          paid: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'issued'] }, { $gte: ['$paidAmount', '$amount'] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Invoice.countDocuments({ status: 'issued', dueDate: { $lt: now }, $expr: { $lt: ['$paidAmount', '$amount'] } }),
    Payment.countDocuments({ receivedAt: { $gte: monthStart } }),
    Payment.find({}).sort({ receivedAt: -1 }).limit(5).populate('customer', 'name phone').populate('invoice', 'reference amount'),
  ]);

  const invoiced = round2(invoiceTotals[0]?.invoiced ?? 0);
  const collected = round2(invoiceTotals[0]?.collected ?? 0);

  return {
    currency: CURRENCY,
    invoiced,
    collected,
    outstanding: round2(invoiced - collected),
    issuedCount: invoiceTotals[0]?.issuedCount ?? 0,
    draftCount: counts[0]?.drafts ?? 0,
    cancelledCount: counts[0]?.cancelled ?? 0,
    partialCount: counts[0]?.partial ?? 0,
    paidCount: counts[0]?.paid ?? 0,
    overdueCount: overdue,
    thisMonth: {
      collected: round2(monthTotals[0]?.sum ?? 0),
      payments: monthPayments,
    },
    recentPayments: recentPayments.map((row) => row.toApiJson()),
  };
}

/** Last N months of invoiced versus received, for the reports screens. */
async function getMonthlySeries(months = 6) {
  const from = startOfMonth();
  from.setMonth(from.getMonth() - (months - 1));

  const [invoiced, collected] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 'issued', issuedAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$issuedAt' } },
          amount: { $sum: '$amount' },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { receivedAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$receivedAt' } },
          amount: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const invoicedByMonth = new Map(invoiced.map((row) => [row._id, row.amount]));
  const collectedByMonth = new Map(collected.map((row) => [row._id, row.amount]));

  const series = [];
  for (let index = 0; index < months; index += 1) {
    const date = new Date(from.getFullYear(), from.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    series.push({
      month: key,
      label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date),
      invoiced: round2(invoicedByMonth.get(key) ?? 0),
      collected: round2(collectedByMonth.get(key) ?? 0),
    });
  }

  return series;
}

export {
  listInvoices,
  createInvoice,
  issueInvoice,
  cancelInvoice,
  recordPayment,
  listPayments,
  listInvoicePayments,
  getBillingSummary,
  getMonthlySeries,
  packageCatalog,
  money,
};
