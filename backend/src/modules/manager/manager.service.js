import Activity from '../../models/Activity.js';
import Complaint from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import Invoice from '../../models/Invoice.js';
import InvoiceAdjustment from '../../models/InvoiceAdjustment.js';
import Job from '../../models/Job.js';
import Payment from '../../models/Payment.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { invoiceFigures } from '../../utils/invoiceMath.js';

const round2 = (value) => Math.round(Number(value ?? 0) * 100) / 100;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const OPEN_COMPLAINT_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer'];

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Manager overview. Every figure is counted from stored records; where a count
 * is zero because nothing has happened yet, the screen shows an empty state
 * rather than an invented trend.
 */
async function getManagerSummary() {
  const monthStart = startOfMonth();
  const now = new Date();

  const completedCustomerIds = await Job.distinct('customer', { status: 'completed' });
  const invoicedJobIds = await Invoice.distinct('job', { status: { $ne: 'cancelled' } });
  const invoicedJobs = invoicedJobIds.filter(Boolean);

  const [
    customerCount,
    briefingPending,
    briefingDone,
    invoicesToDraft,
    invoiceTotals,
    monthCollected,
    openComplaints,
    installationsCompleted,
    installationsInFlight,
  ] = await Promise.all([
    Customer.countDocuments({}),
    Customer.countDocuments({ _id: { $in: completedCustomerIds }, briefingCompleted: false }),
    Customer.countDocuments({ _id: { $in: completedCustomerIds }, briefingCompleted: true }),
    Job.countDocuments({ status: 'completed', _id: { $nin: invoicedJobs } }),
    Invoice.find({ status: 'issued' }).select('amount paidAmount creditedAmount refundedAmount dueDate').lean(),
    Payment.aggregate([
      { $match: { receivedAt: { $gte: monthStart } } },
      { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({ status: { $in: OPEN_COMPLAINT_STATUSES } }),
    Job.countDocuments({ status: 'completed' }),
    Job.countDocuments({ status: { $in: ['unassigned', 'assigned', 'scheduled', 'in_progress'] } }),
  ]);

  // Credit notes lower what is invoiced and refunds lower what is collected, so
  // these figures come from the shared invoice math, not from raw sums.
  let invoiced = 0;
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  for (const invoice of invoiceTotals) {
    const figures = invoiceFigures(invoice);
    invoiced += figures.netAmount;
    collected += figures.netReceived;
    outstanding += figures.balance;
    if (figures.balance > 0 && invoice.dueDate && new Date(invoice.dueDate) < now) overdue += 1;
  }
  invoiced = round2(invoiced);
  collected = round2(collected);
  outstanding = round2(outstanding);

  return {
    currency: 'PKR',
    customers: {
      total: customerCount,
      briefingPending,
      briefingDone,
    },
    invoices: {
      toDraft: invoicesToDraft,
      issued: invoiceTotals.length,
      overdue,
    },
    money: {
      invoiced,
      collected,
      outstanding,
      thisMonthCollected: round2(monthCollected[0]?.sum ?? 0),
      thisMonthPayments: monthCollected[0]?.count ?? 0,
    },
    complaints: { open: openComplaints },
    installations: { completed: installationsCompleted, inFlight: installationsInFlight },
  };
}

/**
 * Global customer lookup. Manager and admin can see every record, including the
 * owner and how far onboarding has gone; the salesperson portfolio is never
 * filtered here because this desk is meant to find any customer.
 */
async function listCustomers({ q, accountStatus, page = 1, limit = 20 } = {}) {
  const filter = {};

  if (accountStatus === 'active' || accountStatus === 'inactive') filter.accountStatus = accountStatus;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [
      { name: regex },
      { phone: regex },
      { email: regex },
      { company: regex },
      { category: regex },
    ];
  }

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [rows, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('owner', 'name role'),
    Customer.countDocuments(filter),
  ]);

  const counts = await Job.aggregate([
    { $match: { customer: { $in: rows.map((row) => row._id) } } },
    {
      $group: {
        _id: '$customer',
        installations: { $sum: { $cond: [{ $eq: ['$requestType', 'new_installation'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      },
    },
  ]);

  const byCustomer = new Map(counts.map((row) => [row._id.toString(), row]));

  return {
    data: rows.map((customer) => {
      const jobs = byCustomer.get(customer._id.toString());
      return {
        ...customer.toApiJson(),
        installations: jobs?.installations ?? 0,
        completedInstallations: jobs?.completed ?? 0,
      };
    }),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

/**
 * Customers whose vehicle is installed but whose security briefing is not done.
 * These accounts stay inactive until the manager completes the briefing, so the
 * longest-waiting customer comes first. Only contact and vehicle details are
 * returned; the sensitive briefing fields are never part of a list.
 */
async function listBriefingPending({ q, page = 1, limit = 20 } = {}) {
  const waiting = await Job.aggregate([
    { $match: { requestType: 'new_installation', status: 'completed' } },
    {
      $group: {
        _id: '$customer',
        since: { $min: { $ifNull: ['$completedAt', '$updatedAt'] } },
        vehicles: {
          $push: {
            label: '$vehicle.label',
            registration: '$vehicle.registration',
            completedAt: { $ifNull: ['$completedAt', '$updatedAt'] },
          },
        },
      },
    },
  ]);

  const byCustomer = new Map(waiting.map((row) => [row._id.toString(), row]));
  const filter = { _id: { $in: waiting.map((row) => row._id) }, briefingCompleted: { $ne: true } };

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { company: regex }];
  }

  const customers = await Customer.find(filter).populate('owner', 'name role');

  const rows = customers
    .map((customer) => {
      const group = byCustomer.get(customer._id.toString());
      return {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone ?? '',
        company: customer.company ?? '',
        owner: customer.owner?.name ? { id: customer.owner._id.toString(), name: customer.owner.name } : null,
        waitingSince: group?.since?.toISOString?.() ?? null,
        vehicles: (group?.vehicles ?? []).map((vehicle) => ({
          label: vehicle.label ?? '',
          registration: vehicle.registration ?? '',
          completedAt: vehicle.completedAt?.toISOString?.() ?? null,
        })),
      };
    })
    .sort((a, b) => new Date(a.waitingSince ?? 0) - new Date(b.waitingSince ?? 0));

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  return {
    data: rows.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    meta: { total: rows.length, page: safePage, limit: safeLimit, pages: Math.ceil(rows.length / safeLimit) },
  };
}

/** One customer with the commercial and service history the manager needs. */
async function getCustomerProfile(customerId) {
  const customer = await Customer.findById(customerId).populate('owner', 'name role email');
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');

  const [jobs, invoices, payments, complaints, adjustments] = await Promise.all([
    Job.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .populate('technician', 'name station'),
    Invoice.find({ customer: customer._id }).sort({ createdAt: -1 }),
    Payment.find({ customer: customer._id }).sort({ receivedAt: -1 }),
    Complaint.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(20),
    InvoiceAdjustment.find({ customer: customer._id }).sort({ issuedAt: -1 }),
  ]);

  const issued = invoices.filter((invoice) => invoice.status === 'issued').map((invoice) => invoiceFigures(invoice));
  const invoicedTotal = round2(issued.reduce((sum, figures) => sum + figures.netAmount, 0));
  const paidTotal = round2(issued.reduce((sum, figures) => sum + figures.netReceived, 0));
  const outstandingTotal = round2(issued.reduce((sum, figures) => sum + figures.balance, 0));
  const refundDueTotal = round2(issued.reduce((sum, figures) => sum + figures.refundable, 0));

  return {
    customer: customer.toDetailJson(),
    jobs: jobs.map((job) => job.toApiJson()),
    invoices: invoices.map((invoice) => invoice.toApiJson()),
    payments: payments.map((payment) => payment.toApiJson()),
    adjustments: adjustments.map((adjustment) => adjustment.toApiJson()),
    complaints: complaints.map((complaint) => complaint.toApiJson()),
    totals: {
      currency: 'PKR',
      invoiced: invoicedTotal,
      paid: paidTotal,
      outstanding: outstandingTotal,
      refundDue: refundDueTotal,
      installations: jobs.filter((job) => job.requestType === 'new_installation').length,
      completedInstallations: jobs.filter((job) => job.status === 'completed').length,
      openComplaints: complaints.filter((complaint) => OPEN_COMPLAINT_STATUSES.includes(complaint.status)).length,
    },
  };
}

/* ------------------------------------------------------------ security briefing */

const CNIC_DIGITS = 13;

function normaliseDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * The manager's gate. A completed installation stays Inactive until these
 * fields exist; saving them is also what activates the account, and the person
 * who did it is recorded.
 */
async function saveBriefing(customerId, input, actor) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');

  const cnic = normaliseDigits(input.cnic);
  if (cnic.length !== CNIC_DIGITS) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the customer CNIC as 13 digits.');
  }

  if (!input.dob) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the customer date of birth.');
  const dob = new Date(input.dob);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid date of birth in the past.');
  }

  const ePin = normaliseDigits(input.ePin);
  if (ePin.length < 4 || ePin.length > 8) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The E-PIN must be 4 to 8 digits.');
  }

  const secondaryPhone = String(input.secondaryPhone ?? '').trim();
  if (secondaryPhone.length < 7) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the secondary user’s phone number.');
  }

  const secondaryRelation = String(input.secondaryRelation ?? '').trim();
  if (!secondaryRelation) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Record how the secondary user is related to the customer.');
  }

  const geofenceAddress = String(input.geofenceAddress ?? '').trim();
  if (geofenceAddress.length < 5) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the vehicle station / geofence address.');
  }

  customer.briefing = {
    cnic,
    dob,
    ePin,
    secondaryPhone,
    secondaryRelation,
    geofenceAddress,
    completedAt: new Date(),
    completedBy: actor.id,
  };
  customer.briefingCompleted = true;
  customer.accountStatus = 'active';
  await customer.save();

  await Activity.create({
    actor: actor.id,
    type: 'customer.briefing_completed',
    label: `Security briefing completed for ${customer.name}`,
    description: 'Account activated after the manager completed the required briefing fields.',
  });

  if (customer.owner) {
    await notifyUser({
      userId: customer.owner,
      type: 'account.activated',
      title: `Account activated · ${customer.name}`,
      body: 'The manager completed the security briefing, so this customer account is now active.',
      link: `/salesperson/customers/${customer._id}`,
      meta: { reference: customer.name, status: 'active', station: geofenceAddress },
    });
  }

  return getCustomerProfile(customer._id);
}

/** Jobs that are finished but have no invoice yet — the manager's billing queue. */
async function listBillingQueue({ page = 1, limit = 20 } = {}) {
  const invoicedJobIds = (await Invoice.distinct('job', { status: { $ne: 'cancelled' } })).filter(Boolean);
  // Only installations are billed; a completed follow-up call has no sale.
  const filter = { status: 'completed', requestType: 'new_installation', _id: { $nin: invoicedJobIds } };

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [rows, total] = await Promise.all([
    Job.find(filter)
      .sort({ completedAt: -1, updatedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('customer', 'name phone'),
    Job.countDocuments(filter),
  ]);

  return {
    data: rows.map((job) => ({
      ...job.toApiJson(),
      customer: job.customer?._id
        ? { id: job.customer._id.toString(), name: job.customer.name, phone: job.customer.phone ?? '' }
        : { id: job.customer?.toString() ?? '', name: job.customerName ?? '', phone: job.phone ?? '' },
    })),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

export { getManagerSummary, listCustomers, listBriefingPending, getCustomerProfile, saveBriefing, listBillingQueue };
