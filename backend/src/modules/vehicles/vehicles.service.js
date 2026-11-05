import Certificate from '../../models/Certificate.js';
import Job from '../../models/Job.js';
import { packageCatalog } from '../../models/Package.js';
import { ensureTrackingLoaded, getSyncStatus, normalizePlate, statusFor, syncTracking } from '../tracking/tracking.service.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATUS_FILTERS = ['active', 'inactive', 'unknown', 'not_tracked'];

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

    vehicles.push({
      id: job._id.toString(),
      jobReference: job.reference,
      customer: { id: job.customer?.toString() ?? '', name: job.customerName ?? '', phone: job.phone ?? '' },
      vehicle: {
        label: job.vehicle?.label ?? '',
        registration: job.vehicle?.registration ?? '',
        station: job.vehicle?.station ?? '',
      },
      deviceImei: job.deviceImei ?? '',
      simNumber: job.simNumber ?? '',
      packageName: job.packageKey ? packageCatalog[job.packageKey]?.name ?? job.packageKey : '',
      technician: job.technician?.name ?? '',
      certificate: certByJob.get(job._id.toString())
        ? { id: certByJob.get(job._id.toString())._id.toString(), number: certByJob.get(job._id.toString()).number, status: certByJob.get(job._id.toString()).status }
        : null,
      installedAt: (job.completedAt ?? job.updatedAt)?.toISOString?.() ?? null,
      tracking: statusFor(job.vehicle?.registration),
    });
  }

  const counts = { total: vehicles.length, active: 0, inactive: 0, unknown: 0, not_tracked: 0 };
  for (const vehicle of vehicles) counts[vehicle.tracking.status] += 1;

  const visible = STATUS_FILTERS.includes(status)
    ? vehicles.filter((vehicle) => vehicle.tracking.status === status)
    : vehicles;

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 25));

  return {
    data: visible.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    meta: {
      total: visible.length,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(visible.length / safeLimit),
      counts,
      sync: getSyncStatus(),
    },
  };
}

async function refreshVehicleStatus() {
  return syncTracking({ manual: true });
}

export { listVehicles, refreshVehicleStatus, getSyncStatus };
