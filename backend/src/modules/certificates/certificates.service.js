import Activity from '../../models/Activity.js';
import Certificate from '../../models/Certificate.js';
import Customer from '../../models/Customer.js';
import Job from '../../models/Job.js';
import { nextSequence } from '../../models/Counter.js';
import { certificateBusiness as biz } from '../../config/business.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const bad = (message) => makeError(errorCodes.VALIDATION_ERROR, message);

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // 31 Jan + 1 month lands on the last day of February
  return d;
}

function parseDate(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw bad(`${name} is not a valid date.`);
  return d;
}

const installedDate = (job) => job.completedAt ?? job.updatedAt ?? job.createdAt;

async function nextNumber() {
  const n = await nextSequence('certificate', biz.numberStart);
  return `${biz.numberPrefix}${n}`;
}

/** What the certificate will print, from the stored records plus what the manager typed in. */
function buildSnapshots(customer, job, input = {}) {
  const v = input.vehicle ?? {};
  const c = input.customer ?? {};
  const pick = (typed, stored, max) => clean(typed !== undefined && typed !== '' ? typed : stored, max);

  return {
    customerSnapshot: {
      name: customer.name,
      phone: customer.phone ?? '',
      cnic: pick(c.cnic, customer.briefing?.cnic, 20),
      address: pick(c.address, customer.address || customer.briefing?.geofenceAddress, 400),
    },
    vehicleSnapshot: {
      registration: clean(job.vehicle?.registration, 60),
      makeModel: pick(v.makeModel, job.vehicle?.label, 120),
      engineNo: pick(v.engineNo, job.vehicle?.engineNo, 60),
      chassisNo: pick(v.chassisNo, job.vehicle?.chassisNo, 60),
      colour: pick(v.colour, job.vehicle?.colour, 40),
      deviceImei: clean(job.deviceImei, 20),
      simNumber: clean(job.simNumber, 40),
    },
  };
}

async function loadEligibleJob(customer, jobId) {
  const job = await Job.findById(jobId);
  if (!job || String(job.customer) !== String(customer._id)) throw bad('That vehicle does not belong to this customer.');
  if (job.requestType !== 'new_installation' || job.status !== 'completed') {
    throw bad(`${job.vehicle?.registration || 'This vehicle'} has no completed installation yet, so it cannot have a certificate.`);
  }
  if (!clean(job.vehicle?.registration)) throw bad('This vehicle has no registration number recorded.');
  return job;
}

/** Keep what the manager typed on the vehicle and customer records, so it is entered once. */
async function saveDetails(customer, job, input = {}) {
  const v = input.vehicle ?? {};
  let changed = false;
  for (const [field, max] of [['engineNo', 60], ['chassisNo', 60], ['colour', 40]]) {
    if (clean(v[field], max) && job.vehicle[field] !== clean(v[field], max)) { job.vehicle[field] = clean(v[field], max); changed = true; }
  }
  if (clean(v.makeModel) && !job.vehicle.label) { job.vehicle.label = clean(v.makeModel); changed = true; }
  if (changed) await job.save();

  const address = clean(input.customer?.address, 400);
  if (address && !customer.address) { customer.address = address; await customer.save(); }
}

async function logActivity(type, label, description, actor, customerId) {
  await Activity.create({ actor: actor.id, type, label, description, recordId: customerId });
}

async function create(customer, job, input, actor, extra = {}) {
  const { customerSnapshot, vehicleSnapshot } = buildSnapshots(customer, job, input);
  const installedAt = parseDate(input.installedAt, 'Installation date') ?? installedDate(job);
  const expiresAt = parseDate(input.expiresAt, 'Expiry date') ?? addMonths(installedAt, biz.validMonths);
  if (expiresAt <= installedAt) throw bad('The expiry date must be after the installation date.');

  const fields = {
    customer: customer._id,
    job: job._id,
    customerSnapshot,
    vehicleSnapshot,
    showCnic: input.showCnic !== false,
    installedAt,
    expiresAt,
    issuedBy: actor.id,
    ...extra,
  };

  // The unique index on the number is the final guard: if two requests ever draw the
  // same number, the loser simply draws another one.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await Certificate.create({ number: await nextNumber(), ...fields });
    } catch (error) {
      if (error?.code !== 11000 || attempt >= 8) throw error;
    }
  }
}

/** Customers on the certificate desk: those with a completed installation, with each vehicle and its certificate state. */
export async function searchCertificateCustomers({ q, limit = 20 } = {}) {
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const installedIds = await Job.distinct('customer', { requestType: 'new_installation', status: 'completed' });
  const filter = { _id: { $in: installedIds } };

  const term = clean(q, 80);
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    const byPlate = await Job.distinct('customer', { requestType: 'new_installation', status: 'completed', 'vehicle.registration': regex });
    filter.$or = [{ name: regex }, { phone: regex }, { company: regex }, { _id: { $in: byPlate } }];
  }

  const customers = await Customer.find(filter).sort({ name: 1 }).limit(safeLimit);
  const ids = customers.map((c) => c._id);
  const jobs = await Job.find({ customer: { $in: ids }, requestType: 'new_installation', status: 'completed' }).sort({ completedAt: -1 });
  const certs = await Certificate.find({ job: { $in: jobs.map((j) => j._id) } }).sort({ issuedAt: -1 });

  const latestByJob = new Map();
  for (const cert of certs) {
    const key = cert.job.toString();
    const current = latestByJob.get(key);
    // An active certificate always wins; otherwise show the most recent one.
    if (!current || (cert.status === 'active' && current.status !== 'active')) latestByJob.set(key, cert);
  }

  return customers.map((customer) => ({
    id: customer._id.toString(),
    name: customer.name,
    phone: customer.phone ?? '',
    company: customer.company ?? '',
    address: customer.address ?? '',
    cnic: customer.briefing?.cnic ?? '',
    vehicles: jobs.filter((job) => String(job.customer) === String(customer._id)).map((job) => {
      const cert = latestByJob.get(job._id.toString());
      return {
        jobId: job._id.toString(),
        jobReference: job.reference,
        registration: job.vehicle?.registration ?? '',
        makeModel: job.vehicle?.label ?? '',
        engineNo: job.vehicle?.engineNo ?? '',
        chassisNo: job.vehicle?.chassisNo ?? '',
        colour: job.vehicle?.colour ?? '',
        deviceImei: job.deviceImei ?? '',
        installedAt: installedDate(job)?.toISOString?.() ?? null,
        certificate: cert ? { id: cert._id.toString(), number: cert.number, status: cert.status } : null,
      };
    }),
  }));
}

/** Issue one certificate per selected vehicle. Everything is checked first so a bad selection issues nothing. */
export async function issueCertificates({ customerId, vehicles = [], customer: customerInput, showCnic }, actor) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');
  if (!Array.isArray(vehicles) || vehicles.length === 0) throw bad('Select at least one vehicle.');
  if (vehicles.length > 25) throw bad('Issue at most 25 certificates at a time.');

  const seen = new Set();
  const prepared = [];
  for (const entry of vehicles) {
    if (seen.has(String(entry.jobId))) throw bad('A vehicle was selected twice.');
    seen.add(String(entry.jobId));
    const job = await loadEligibleJob(customer, entry.jobId);
    const active = await Certificate.findOne({ job: job._id, status: 'active' });
    if (active) throw makeError(errorCodes.CONFLICT, `${job.vehicle.registration} already has active certificate ${active.number}. Use Reissue to replace it.`, 409);
    prepared.push({ job, entry });
  }

  const issued = [];
  for (const { job, entry } of prepared) {
    const input = { vehicle: entry, customer: customerInput, showCnic, installedAt: entry.installedAt, expiresAt: entry.expiresAt };
    await saveDetails(customer, job, input);
    const cert = await create(customer, job, input, actor);
    await logActivity('certificate.issued', `Certificate ${cert.number} issued for ${job.vehicle.registration}`, customer.name, actor, customer._id);
    issued.push(cert.toApiJson());
  }
  return issued;
}

export async function reissueCertificate(id, input = {}, actor) {
  const old = await Certificate.findById(id);
  if (!old) throw makeError(errorCodes.NOT_FOUND, 'No certificate matches that id.');
  if (old.status !== 'active') throw makeError(errorCodes.CONFLICT, 'Only an active certificate can be reissued.', 409);

  const reason = clean(input.reason, 400);
  if (reason.length < 3) throw bad('Write why the certificate is being reissued.');

  const customer = await Customer.findById(old.customer);
  const job = await Job.findById(old.job);
  if (!customer || !job) throw makeError(errorCodes.NOT_FOUND, 'The customer or vehicle for this certificate no longer exists.');

  await saveDetails(customer, job, input);
  const fresh = await create(customer, job, { ...input, showCnic: input.showCnic ?? old.showCnic, installedAt: input.installedAt ?? old.installedAt }, actor, { reissueOf: old._id, reissueReason: reason });

  old.status = 'superseded';
  old.replacedBy = fresh._id;
  await old.save();

  await logActivity('certificate.reissued', `Certificate ${old.number} reissued as ${fresh.number}`, `${old.vehicleSnapshot.registration} · ${reason}`, actor, customer._id);
  return fresh.toApiJson();
}

export async function cancelCertificate(id, { reason } = {}, actor) {
  const cert = await Certificate.findById(id);
  if (!cert) throw makeError(errorCodes.NOT_FOUND, 'No certificate matches that id.');
  if (cert.status !== 'active') throw makeError(errorCodes.CONFLICT, 'Only an active certificate can be cancelled.', 409);

  const text = clean(reason, 400);
  if (text.length < 3) throw bad('Write why the certificate is being cancelled.');

  cert.status = 'cancelled';
  cert.cancelledAt = new Date();
  cert.cancelledBy = actor.id;
  cert.cancelReason = text;
  await cert.save();

  await logActivity('certificate.cancelled', `Certificate ${cert.number} cancelled`, `${cert.vehicleSnapshot.registration} · ${text}`, actor, cert.customer);
  return cert.toApiJson();
}

export async function getCertificate(id) {
  const cert = await Certificate.findById(id).populate('issuedBy', 'name');
  if (!cert) throw makeError(errorCodes.NOT_FOUND, 'No certificate matches that id.');
  return cert.toApiJson();
}

export async function listCertificates({ q, status, customer, job, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (['active', 'cancelled', 'superseded'].includes(status)) filter.status = status;
  if (customer) filter.customer = customer;
  if (job) filter.job = job;

  const term = clean(q, 80);
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ number: regex }, { 'vehicleSnapshot.registration': regex }, { 'customerSnapshot.name': regex }, { 'customerSnapshot.phone': regex }];
  }

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const [rows, total] = await Promise.all([
    Certificate.find(filter).sort({ issuedAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate('issuedBy', 'name'),
    Certificate.countDocuments(filter),
  ]);

  return { data: rows.map((row) => row.toApiJson()), meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
}
