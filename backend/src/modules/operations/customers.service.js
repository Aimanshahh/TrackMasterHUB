import Certificate from '../../models/Certificate.js';
import Complaint from '../../models/Complaint.js';
import Customer from '../../models/Customer.js';
import Job from '../../models/Job.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { coreVrn } from '../../utils/vrn.js';

const OPEN_COMPLAINT_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer'];
const MAX_RESULTS = 25;
const MIN_SEARCH_LENGTH = 2;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plateKey = (value) => coreVrn(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Search-first customer lookup for the operations desk. Nothing is returned
 * until there is something to search for, and never more than a handful of rows,
 * so the screen stays fast however many customers exist.
 * A customer is found by name, company, phone number or the registration of any
 * of their vehicles.
 */
export async function searchCustomers({ search, limit = 20 } = {}) {
  const term = String(search ?? '').trim();
  const safeLimit = Math.min(MAX_RESULTS, Math.max(1, Number.parseInt(limit, 10) || 20));
  if (term.length < MIN_SEARCH_LENGTH) return { data: [], meta: { searched: false, total: 0, limit: safeLimit, minLength: MIN_SEARCH_LENGTH } };

  const or = [{ name: new RegExp(escapeRegex(term), 'i') }, { company: new RegExp(escapeRegex(term), 'i') }];

  const digits = term.replace(/\D/g, '');
  if (digits.length >= 4) or.push({ phone: new RegExp([...digits].join('\\D*')) });

  // The registration may be typed with or without dashes and spaces: AB-123, AB 123, AB123.
  const plateText = term.replace(/[^A-Za-z0-9]/g, '');
  const matchedPlate = new Map(); // customer id -> registration that matched
  if (plateText.length >= 2) {
    const plateRegex = new RegExp([...plateText].map(escapeRegex).join('[^A-Za-z0-9]*'), 'i');
    const jobs = await Job.find({ 'vehicle.registration': plateRegex, requestType: 'new_installation', status: { $ne: 'cancelled' } })
      .select('customer vehicle.registration').limit(60).lean();
    for (const job of jobs) if (job.customer && !matchedPlate.has(String(job.customer))) matchedPlate.set(String(job.customer), coreVrn(job.vehicle?.registration));
    if (matchedPlate.size) or.push({ _id: { $in: [...matchedPlate.keys()] } });
  }

  const customers = await Customer.find({ $or: or }).sort({ name: 1 }).limit(safeLimit);

  // One query for every vehicle count; a two-device vehicle counts once.
  const jobs = customers.length
    ? await Job.find({ customer: { $in: customers.map((c) => c._id) }, requestType: 'new_installation', status: { $ne: 'cancelled' } }).select('customer vehicle.registration').lean()
    : [];
  const plates = new Map();
  for (const job of jobs) {
    const key = String(job.customer);
    if (!plates.has(key)) plates.set(key, new Set());
    plates.get(key).add(plateKey(job.vehicle?.registration) || String(job._id));
  }

  return {
    data: customers.map((customer) => ({
      id: customer._id.toString(),
      name: customer.name,
      company: customer.company ?? '',
      phone: customer.phone ?? '',
      category: customer.category ?? '',
      vehicleCount: plates.get(String(customer._id))?.size ?? 0,
      matchedVrn: matchedPlate.get(String(customer._id)) ?? '',
    })),
    meta: { searched: true, total: customers.length, limit: safeLimit, more: customers.length === safeLimit },
  };
}

/**
 * One customer for the operations desk: contact details, app login, vehicles,
 * certificates and complaints. No prices, invoices, payments or security briefing.
 */
export async function getCustomerProfile(customerId) {
  const customer = await Customer.findById(customerId).populate('owner', 'name role email');
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.', 404);

  const [jobs, complaints, certificates] = await Promise.all([
    Job.find({ customer: customer._id }).sort({ createdAt: -1 }).populate('technician', 'name station'),
    Complaint.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(20),
    Certificate.find({ customer: customer._id }).sort({ issuedAt: -1 }),
  ]);

  return {
    customer: customer.toOperationsJson(),
    jobs: jobs.map((job) => job.toApiJson({ includeFinancials: false })),
    invoices: [],
    payments: [],
    adjustments: [],
    certificates: certificates.map((certificate) => certificate.toApiJson()),
    complaints: complaints.map((complaint) => complaint.toApiJson()),
    totals: {
      currency: 'PKR',
      invoiced: 0,
      paid: 0,
      outstanding: 0,
      refundDue: 0,
      installations: jobs.filter((job) => job.requestType === 'new_installation').length,
      completedInstallations: jobs.filter((job) => job.status === 'completed').length,
      openComplaints: complaints.filter((complaint) => OPEN_COMPLAINT_STATUSES.includes(complaint.status)).length,
    },
  };
}
