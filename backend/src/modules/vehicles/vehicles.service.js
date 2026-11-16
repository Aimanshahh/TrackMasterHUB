import Certificate from '../../models/Certificate.js';
import Job, { PHYSICAL_STATUSES } from '../../models/Job.js';
import { packageCatalog } from '../../models/Package.js';
import { engineKillLabels } from '../../utils/installation.js';
import { makeError } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';
import { ensureTrackingLoaded, getSyncStatus, normalizePlate, statusFor, syncTracking } from '../tracking/tracking.service.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATUS_FILTERS = ['active', 'inactive', 'unknown', 'not_tracked'];
const TRACKING_UNAVAILABLE = new Set(['inactive', 'unknown', 'not_tracked']);

function amcStatusFor(value, trackingStatus, now = new Date()) {
  if (!value) return 'unknown';
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return 'unknown';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const daysExpired = Math.floor((today - expiry) / 86_400_000);
  if (daysExpired > 0) return 'expired';
  if (TRACKING_UNAVAILABLE.has(trackingStatus)) return 'active_no_tracker';
  const daysRemaining = Math.floor((expiry - today) / 86_400_000);
  return daysRemaining < 30 ? 'expiring_soon' : 'active';
}

function physicalStatusFor(job, trackingStatus) {
  return job.vehicle?.physicalStatus
    || (TRACKING_UNAVAILABLE.has(trackingStatus) ? 'Pending Inspection' : 'Verified Active');
}

function portalLabel(value) {
  if (value === 'Portal 1' || value === 'Portal 2') return value;
  if (String(value ?? '').includes('L8')) return 'Portal 2';
  if (String(value ?? '').includes('Main Server')) return 'Portal 1';
  return '';
}

/**
 * Every installed vehicle, joined with its live status from the tracking
 * server. A vehicle is one completed installation; if the same plate was
 * installed more than once (a redo) only the latest one is listed.
 */
async function listVehicles({ q, status, page = 1, limit = 25 } = {}) {
  await ensureTrackingLoaded();

  const filter = { requestType: 'new_installation', status: 'completed' };

  if (q) {
    const regex = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [
      { 'vehicle.registration': regex },
      { 'vehicle.label': regex },
      { customerName: regex },
      { phone: regex },
      { deviceImei: regex },
      { simNumber: regex },
    ];
  }

  const jobs = await Job.find(filter)
    .sort({ completedAt: -1, createdAt: -1 })
    .populate('technician', 'name')
    .lean();

  const certs = await Certificate.find({ job: { $in: jobs.map((j) => j._id) } }).sort({ issuedAt: -1 }).lean();
  const certByJob = new Map();
  for (const c of certs) {
    const key = c.job.toString();
    const current = certByJob.get(key);
    if (!current || (c.status === 'active' && current.status !== 'active')) certByJob.set(key, c);
  }

  const seen = new Set();
  const vehicles = [];

  for (const job of jobs) {
    const plate = normalizePlate(job.vehicle?.registration);
    const key = plate || job._id.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const tracking = statusFor(job.vehicle?.registration, job.deviceImei);
    const amcExpiryDate = job.amcExpiryDate?.toISOString?.() ?? tracking.amcExpiryDate;
    const amcStatus = amcStatusFor(amcExpiryDate, tracking.status);
    vehicles.push({
      id: job._id.toString(),
      jobReference: job.reference,
      customer: { id: job.customer?.toString() ?? '', name: job.customerName ?? '', phone: job.phone ?? '' },
      vehicle: {
        label: job.vehicle?.label ?? '',
        registration: job.vehicle?.registration ?? '',
        station: job.vehicle?.station ?? '',
      },
      engineKill: { status: job.installation?.engineKill?.status ?? 'not_set', label: engineKillLabels[job.installation?.engineKill?.status ?? 'not_set'] },
      deviceImei: job.deviceImei ?? '',
      simNumber: job.simNumber ?? '',
      packageName: job.packageKey ? packageCatalog[job.packageKey]?.name ?? job.packageKey : '',
      technician: job.technician?.name ?? '',
      certificate: certByJob.get(job._id.toString())
        ? { id: certByJob.get(job._id.toString())._id.toString(), number: certByJob.get(job._id.toString()).number, status: certByJob.get(job._id.toString()).status }
        : null,
      installedAt: (job.completedAt ?? job.updatedAt)?.toISOString?.() ?? null,
      portalSource: portalLabel(job.portalSource) || portalLabel(tracking.portalSource) || 'Unassigned',
      amcExpiryDate,
      amcStatus,
      physicalStatus: physicalStatusFor(job, tracking.status),
      inspectionNotes: job.vehicle?.inspectionNotes ?? '',
      lastInspectedAt: job.vehicle?.lastInspectedAt?.toISOString?.() ?? null,
      inspectedBy: job.vehicle?.inspectedBy ?? '',
      tracking,
    });
  }

  const counts = { total: vehicles.length, active: 0, inactive: 0, unknown: 0, not_tracked: 0 };
  for (const vehicle of vehicles) counts[vehicle.tracking.status] += 1;
  const amcCounts = { active: 0, expiring_soon: 0, active_no_tracker: 0, expired: 0, unknown: 0 };
  for (const vehicle of vehicles) amcCounts[vehicle.amcStatus] += 1;

  const visible = STATUS_FILTERS.includes(status)
    ? vehicles.filter((vehicle) => vehicle.tracking.status === status)
    : vehicles;

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(2000, Math.max(1, Number.parseInt(limit, 10) || 25));

  return {
    data: visible.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    meta: {
      total: visible.length,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(visible.length / safeLimit),
      counts,
      amcCounts: {
        ...amcCounts,
        total_expired: amcCounts.expired,
      },
      sync: getSyncStatus(),
    },
  };
}

/** Matches one plate however it was typed (spaces, dashes). */
const plateRegex = (plate) => new RegExp(`^${[...String(plate).replace(/[^A-Za-z0-9]/g, '')].map((c) => escapeRegex(c)).join('[^A-Za-z0-9]*')}$`, 'i');

/**
 * Everything known about one vehicle: the customer, the device and SIM now
 * fitted, engine-kill status with its full history, every installation record
 * (with checklist and remarks) and the service jobs since. A vehicle is
 * identified by its plate, so a redo or a later service job joins the same profile.
 */
async function getVehicleProfile(id, lookup = '') {
  const anchor = await Job.findById(id).lean().catch(() => null);
  if (!anchor || anchor.requestType !== 'new_installation') {
    throw makeError(errorCodes.NOT_FOUND, 'No vehicle matches that id.', 404);
  }
  if (lookup) {
    const needle = String(lookup).trim().toLowerCase();
    const searchable = [
      anchor.vehicle?.registration,
      anchor.vehicle?.label,
      anchor.customerName,
      anchor.phone,
      anchor.deviceImei,
      anchor.simNumber,
    ].map((value) => String(value ?? '').toLowerCase());
    const plateNeedle = normalizePlate(lookup);
    const plateMatch = plateNeedle && normalizePlate(anchor.vehicle?.registration).includes(plateNeedle);
    if (!searchable.some((value) => value.includes(needle)) && !plateMatch) {
      throw makeError(errorCodes.NOT_FOUND, 'No vehicle matches that search.', 404);
    }
  }

  const plate = normalizePlate(anchor.vehicle?.registration);
  const jobs = plate
    ? await Job.find({ 'vehicle.registration': plateRegex(plate) }).sort({ createdAt: 1 }).populate('technician', 'name station')
    : [await Job.findById(id).populate('technician', 'name station')];

  const installs = jobs.filter((j) => j.requestType === 'new_installation' && j.status !== 'cancelled');
  const current = [...installs].reverse().find((j) => j.status === 'completed') ?? installs[installs.length - 1];
  const certs = await Certificate.find({ job: { $in: jobs.map((j) => j._id) } }).sort({ issuedAt: -1 });
  await ensureTrackingLoaded();

  const engineKillHistory = installs
    .flatMap((j) => (j.engineKillHistory ?? []).map((e) => ({ ...e.toObject(), jobReference: j.reference, at: e.at?.toISOString(), toLabel: engineKillLabels[e.to] })))
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  const customerJob = current ?? jobs[0];
  const tracking = statusFor(current.vehicle?.registration, current.deviceImei);
  const amcExpiryDate = current.amcExpiryDate?.toISOString?.() ?? tracking.amcExpiryDate;

  return {
    data: {
      id: current._id.toString(),
      vehicle: {
        label: current.vehicle?.label ?? '',
        registration: current.vehicle?.registration ?? '',
        engineNo: current.vehicle?.engineNo ?? '',
        chassisNo: current.vehicle?.chassisNo ?? '',
        colour: current.vehicle?.colour ?? '',
        station: current.vehicle?.station ?? '',
      },
      customer: { id: customerJob.customer?.toString() ?? '', name: customerJob.customerName ?? '', phone: customerJob.phone ?? '' },
      device: { imei: current.deviceImei ?? '', simNumber: current.simNumber ?? '', model: current.installation?.deviceModel ?? '', placement: current.installation?.placement ?? '' },
      engineKill: current.toApiJson().engineKill,
      engineKillHistory,
      tracking,
      portalSource: portalLabel(current.portalSource) || portalLabel(tracking.portalSource) || 'Unassigned',
      amcExpiryDate,
      amcStatus: amcStatusFor(amcExpiryDate, tracking.status),
      physicalStatus: physicalStatusFor(current, tracking.status),
      inspectionNotes: current.vehicle?.inspectionNotes ?? '',
      lastInspectedAt: current.vehicle?.lastInspectedAt?.toISOString?.() ?? null,
      inspectedBy: current.vehicle?.inspectedBy ?? '',
      installations: installs.map((j) => j.toApiJson()),
      serviceJobs: jobs.filter((j) => j.requestType !== 'new_installation').map((j) => j.toApiJson()),
      certificates: certs.map((c) => c.toApiJson()),
    },
  };
}

async function logVehicleInspection(id, input, actor) {
  const job = await Job.findById(id);
  if (!job || job.requestType !== 'new_installation' || job.status !== 'completed') {
    throw makeError(errorCodes.NOT_FOUND, 'No completed vehicle matches that id.', 404);
  }

  if (!PHYSICAL_STATUSES.includes(input.physicalStatus)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid physical status.');
  }

  job.vehicle.physicalStatus = input.physicalStatus;
  job.vehicle.inspectionNotes = String(input.inspectionNotes ?? '').trim().slice(0, 2000);
  job.vehicle.lastInspectedAt = new Date();
  job.vehicle.inspectedBy = String(actor.id);
  await job.save();
  return getVehicleProfile(id);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportPendingInspections() {
  const { data } = await listVehicles({ limit: 2000 });
  const rows = data.filter((vehicle) => vehicle.physicalStatus === 'Pending Inspection');
  const header = ['Plate', 'Customer Name', 'Phone', 'Last known Tracker ID'];
  const lines = rows.map((vehicle) => [
    vehicle.vehicle.registration,
    vehicle.customer.name,
    vehicle.customer.phone,
    vehicle.deviceImei,
  ].map(csvCell).join(','));
  return [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}

async function refreshVehicleStatus() {
  return syncTracking({ manual: true });
}

export {
  exportPendingInspections,
  getVehicleProfile,
  listVehicles,
  logVehicleInspection,
  refreshVehicleStatus,
  getSyncStatus,
  amcStatusFor,
};
