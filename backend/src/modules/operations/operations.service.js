import Customer from '../../models/Customer.js';
import Device from '../../models/Device.js';
import Job, { JOB_STATUSES, jobStatusLabels } from '../../models/Job.js';
import Notification from '../../models/Notification.js';
import Sim from '../../models/Sim.js';
import Technician from '../../models/Technician.js';
import User from '../../models/User.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';

/** A station is flagged when it has fewer available devices than this. */
export const LOW_STOCK_THRESHOLD = 3;

/** Do not repeat the same station warning within this window. */
const LOW_STOCK_ALERT_WINDOW_HOURS = 12;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pageParams(page, limit) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

/* ---------------------------------- Jobs --------------------------------- */

async function listJobs({ status, priority, q, technician, page = 1, limit = 20 }) {
  const filter = {};

  if (status && JOB_STATUSES.includes(status)) filter.status = status;
  if (priority) filter.priority = priority;
  if (technician) filter.technician = technician;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ reference: regex }, { customerName: regex }, { phone: regex }, { 'vehicle.registration': regex }, { deviceImei: regex }, { simNumber: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).populate('technician', 'name station'),
    Job.countDocuments(filter),
  ]);

  return {
    data: rows.map((job) => job.toApiJson()),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

async function getJobById(id) {
  const job = await Job.findById(id).populate('technician', 'name station');
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No operations job matches that id.');
  return job;
}

async function createJob(input, actor) {
  if (!input.customerId) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the customer this work belongs to.');
  }

  const customer = await Customer.findById(input.customerId);
  if (!customer) throw makeError(errorCodes.VALIDATION_ERROR, 'That customer record does not exist.');

  const requestType = input.requestType === 'follow_up' ? 'follow_up' : 'new_installation';
  const vehicle = {
    label: input.vehicleLabel?.trim() ?? '',
    registration: input.vehicleRegistration?.trim() ?? '',
    station: input.station?.trim() ?? '',
  };

  if (requestType === 'new_installation') {
    if (!vehicle.label || !vehicle.registration) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Vehicle name and registration are required for a new installation.');
    }
    if (!vehicle.station) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the installation station or location.');
    }
  }

  const job = new Job({
    customer: customer._id,
    customerName: customer.name,
    phone: customer.phone ?? '',
    requestType,
    vehicle,
    priority: input.priority ?? 'normal',
    notes: input.notes?.trim(),
    createdBy: actor.id,
    history: [{ status: 'unassigned', note: 'Job created and added to the operations queue.', at: new Date(), by: actor.id }],
  });

  await job.save();
  return job.toApiJson();
}

async function releaseDevice(imei, jobId) {
  await Device.updateOne({ imei, job: jobId }, { $set: { status: 'in_stock' }, $unset: { job: 1, technician: 1 } });
}

async function releaseSim(number, jobId) {
  await Sim.updateOne({ number, job: jobId }, { $set: { status: 'in_stock' }, $unset: { job: 1, technician: 1 } });
}

async function updateJob(id, input, actor) {
  const job = await Job.findById(id);
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No operations job matches that id.');

  const previousStatus = job.status;

  if (input.status !== undefined && !JOB_STATUSES.includes(input.status)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid job status.');
  }

  /* Technician */
  if (input.technicianId !== undefined) {
    if (!input.technicianId) {
      job.technician = null;
    } else {
      const technician = await Technician.findById(input.technicianId);
      if (!technician || !technician.active) {
        throw makeError(errorCodes.VALIDATION_ERROR, 'Choose an active technician.');
      }
      job.technician = technician._id;
    }
  }

  /* Vehicle and schedule */
  if (input.station !== undefined) job.vehicle.station = input.station.trim();
  if (input.vehicleLabel !== undefined) job.vehicle.label = input.vehicleLabel.trim();
  if (input.vehicleRegistration !== undefined) job.vehicle.registration = input.vehicleRegistration.trim();
  if (input.priority !== undefined) job.priority = input.priority;
  if (input.notes !== undefined) job.notes = input.notes.trim();
  if (input.scheduledAt !== undefined) {
    job.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (job.scheduledAt && Number.isNaN(job.scheduledAt.getTime())) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid schedule date.');
    }
  }

  /* Device allocation */
  if (input.deviceImei !== undefined) {
    const imei = String(input.deviceImei ?? '').trim();

    if (imei !== job.deviceImei) {
      if (job.deviceImei) await releaseDevice(job.deviceImei, job._id);

      if (imei) {
        const device = await Device.findOne({ imei });
        if (!device) throw makeError(errorCodes.VALIDATION_ERROR, 'That IMEI is not recorded in device stock.');
        if (device.status === 'out_of_service') throw makeError(errorCodes.VALIDATION_ERROR, 'That device is marked out of service and cannot be assigned.');
        if (device.job && String(device.job) !== String(job._id)) {
          throw makeError(errorCodes.CONFLICT, 'That device is already assigned to another job.', 409);
        }

        device.status = 'assigned';
        device.job = job._id;
        device.technician = job.technician ?? device.technician ?? null;
        device.station = job.vehicle.station ?? device.station;
        await device.save();
      }

      job.deviceImei = imei;
    }
  }

  /* SIM allocation */
  if (input.simNumber !== undefined) {
    const number = String(input.simNumber ?? '').trim();

    if (number !== job.simNumber) {
      if (job.simNumber) await releaseSim(job.simNumber, job._id);

      if (number) {
        const sim = await Sim.findOne({ number });
        if (!sim) throw makeError(errorCodes.VALIDATION_ERROR, 'That SIM number is not recorded in SIM stock.');
        if (sim.status === 'out_of_service') throw makeError(errorCodes.VALIDATION_ERROR, 'That SIM is marked out of service and cannot be assigned.');
        if (sim.job && String(sim.job) !== String(job._id)) {
          throw makeError(errorCodes.CONFLICT, 'That SIM is already assigned to another job.', 409);
        }

        sim.status = 'assigned';
        sim.job = job._id;
        sim.technician = job.technician ?? sim.technician ?? null;
        sim.station = job.vehicle.station ?? sim.station;
        await sim.save();
      }

      job.simNumber = number;
    }
  }

  /* Status */
  const nextStatus = input.status ?? job.status;

  if (['assigned', 'scheduled', 'in_progress', 'completed'].includes(nextStatus) && !job.technician) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Assign a technician before moving this job forward.');
  }

  if (nextStatus === 'completed' && job.requestType === 'new_installation' && (!job.deviceImei || !job.simNumber)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Record the device IMEI and SIM number before completing the installation.');
  }

  job.status = nextStatus;

  if (nextStatus === 'completed' && previousStatus !== 'completed') job.completedAt = new Date();
  if (nextStatus !== 'completed') job.completedAt = null;

  const statusChanged = nextStatus !== previousStatus;

  if (statusChanged || input.note) {
    job.history.push({
      status: nextStatus,
      note: input.note?.trim() || (statusChanged ? `Status moved to ${jobStatusLabels[nextStatus]}.` : ''),
      at: new Date(),
      by: actor.id,
    });
  }

  const stockContextChanged = job.isModified('technician') || job.isModified('vehicle.station');

  await job.save();

  if (nextStatus === 'cancelled') {
    if (job.deviceImei) await releaseDevice(job.deviceImei, job._id);
    if (job.simNumber) await releaseSim(job.simNumber, job._id);
    job.deviceImei = '';
    job.simNumber = '';
    await job.save();
  }

  const refreshed = await Job.findById(job._id).populate('technician', 'name station');

  /* A device has just left station stock and been fitted for this technician. */
  if (input.deviceImei && job.deviceImei) {
    await checkStationStock(job.vehicle.station);
    if (job.technician) await checkTechnicianStock(job.technician);
  }

  /* Keep allocated stock in step with the technician and station. */
  if (stockContextChanged) {
    await Promise.all([
      Device.updateMany({ job: job._id }, { $set: { technician: job.technician ?? null, station: job.vehicle.station ?? '' } }),
      Sim.updateMany({ job: job._id }, { $set: { technician: job.technician ?? null, station: job.vehicle.station ?? '' } }),
    ]);
  }

  /* The salesperson who pushed the job owns the follow-up. */
  if (statusChanged && refreshed.createdBy && String(refreshed.createdBy) !== String(actor.id)) {
    await notifyUser({
      userId: refreshed.createdBy,
      type: 'installation.status_changed',
      title: `Installation ${job.reference} · ${jobStatusLabels[nextStatus]}`,
      body: `${job.customerName || 'Customer'}${job.vehicle?.label ? ` — ${job.vehicle.label}` : ''}`,
      link: '/salesperson',
      meta: { reference: job.reference, recordId: job._id.toString(), status: nextStatus },
    });
  }

  return refreshed.toApiJson();
}

/**
 * Available device stock grouped by station. Stations that exist on job or
 * technician records are included even when they currently hold no stock, so a
 * depleted station cannot silently disappear from the screen.
 */
async function getStockByStation() {
  const [deviceRows, simRows, technicianStations, jobStations] = await Promise.all([
    Device.aggregate([{ $group: { _id: { station: '$station', status: '$status' }, count: { $sum: 1 } } }]),
    Sim.aggregate([{ $group: { _id: { station: '$station', status: '$status' }, count: { $sum: 1 } } }]),
    Technician.distinct('station'),
    Job.distinct('vehicle.station'),
  ]);

  const stations = new Map();

  const ensure = (rawName) => {
    const station = String(rawName ?? '').trim();
    if (!station) return null;

    if (!stations.has(station)) {
      stations.set(station, {
        station,
        devices: { total: 0, in_stock: 0, assigned: 0, out_of_service: 0 },
        sims: { total: 0, in_stock: 0, assigned: 0, out_of_service: 0 },
      });
    }

    return stations.get(station);
  };

  for (const station of technicianStations) ensure(station);
  for (const station of jobStations) ensure(station);

  for (const row of deviceRows) {
    const entry = ensure(row._id?.station);
    if (!entry) continue;
    entry.devices.total += row.count;
    if (entry.devices[row._id.status] !== undefined) entry.devices[row._id.status] += row.count;
  }

  for (const row of simRows) {
    const entry = ensure(row._id?.station);
    if (!entry) continue;
    entry.sims.total += row.count;
    if (entry.sims[row._id.status] !== undefined) entry.sims[row._id.status] += row.count;
  }

  const data = [...stations.values()]
    .map((entry) => ({ ...entry, low: entry.devices.in_stock < LOW_STOCK_THRESHOLD }))
    .sort((a, b) => Number(b.low) - Number(a.low) || a.station.localeCompare(b.station));

  return { data, meta: { lowStockThreshold: LOW_STOCK_THRESHOLD } };
}

/**
 * Warn the desk when a station drops below the available-device threshold.
 * Repeats are suppressed for a short window so one busy day cannot flood the
 * notification list.
 */
async function checkStationStock(rawStation) {
  const station = String(rawStation ?? '').trim();
  if (!station) return;

  const available = await Device.countDocuments({ station, status: 'in_stock' });
  if (available >= LOW_STOCK_THRESHOLD) return;

  const since = new Date(Date.now() - LOW_STOCK_ALERT_WINDOW_HOURS * 60 * 60 * 1000);
  const alreadyRaised = await Notification.exists({
    type: 'stock.low',
    'meta.station': station,
    'meta.recordId': { $exists: false },
    createdAt: { $gte: since },
  });
  if (alreadyRaised) return;

  const recipients = await User.find({ active: true, role: { $in: ['operations', 'admin'] } }).select('role');

  await Promise.all(recipients.map((user) => notifyUser({
    userId: user._id,
    type: 'stock.low',
    title: `Low station stock · ${station}`,
    body: `${available} device${available === 1 ? '' : 's'} left available at ${station}. Restock or transfer devices.`,
    link: user.role === 'admin' ? '/admin/operations' : '/operations/inventory',
    meta: { station, status: String(available) },
  })));
}

/**
 * Warn when a technician is down to fewer than the threshold of unfitted
 * devices. Stock they have already fitted to a job does not count, because it
 * is no longer available for the next installation.
 */
async function checkTechnicianStock(technicianId) {
  if (!technicianId) return;

  const technician = await Technician.findById(technicianId);
  if (!technician) return;

  const held = await Device.countDocuments({ technician: technician._id, status: 'assigned', job: null });
  if (held >= LOW_STOCK_THRESHOLD) return;

  const since = new Date(Date.now() - LOW_STOCK_ALERT_WINDOW_HOURS * 60 * 60 * 1000);
  const alreadyRaised = await Notification.exists({
    type: 'stock.low',
    'meta.recordId': technician._id.toString(),
    createdAt: { $gte: since },
  });
  if (alreadyRaised) return;

  const recipients = await User.find({ active: true, role: { $in: ['operations', 'admin'] } }).select('role');
  const where = technician.station ? ` (${technician.station})` : '';

  await Promise.all(recipients.map((user) => notifyUser({
    userId: user._id,
    type: 'stock.low',
    title: `Low technician stock · ${technician.name}`,
    body: `${held} device${held === 1 ? '' : 's'} left with ${technician.name}${where}. Assign more devices.`,
    link: user.role === 'admin' ? '/admin/operations' : '/operations/technicians',
    meta: { station: technician.station ?? '', recordId: technician._id.toString(), status: String(held) },
  })));
}

/** Device and SIM stock currently held by each technician. */
async function getStockByTechnician() {
  const [technicians, deviceRows, simRows] = await Promise.all([
    Technician.find().sort({ name: 1 }),
    Device.aggregate([
      { $match: { technician: { $ne: null } } },
      { $group: { _id: { technician: '$technician', fitted: { $cond: [{ $ifNull: ['$job', false] }, true, false] } }, count: { $sum: 1 } } },
    ]),
    Sim.aggregate([
      { $match: { technician: { $ne: null } } },
      { $group: { _id: { technician: '$technician', fitted: { $cond: [{ $ifNull: ['$job', false] }, true, false] } }, count: { $sum: 1 } } },
    ]),
  ]);

  const blank = () => ({ held: 0, fitted: 0, total: 0 });
  const byTechnician = new Map(technicians.map((technician) => [technician._id.toString(), {
    technicianId: technician._id.toString(),
    name: technician.name,
    station: technician.station ?? '',
    active: technician.active,
    devices: blank(),
    sims: blank(),
  }]));

  const apply = (rows, key) => {
    for (const row of rows) {
      const entry = byTechnician.get(String(row._id?.technician));
      if (!entry) continue;
      const bucket = entry[key];
      bucket.total += row.count;
      if (row._id.fitted) bucket.fitted += row.count;
      else bucket.held += row.count;
    }
  };

  apply(deviceRows, 'devices');
  apply(simRows, 'sims');

  const data = [...byTechnician.values()]
    .map((entry) => ({ ...entry, low: entry.devices.held < LOW_STOCK_THRESHOLD }))
    .sort((a, b) => Number(b.low) - Number(a.low) || a.name.localeCompare(b.name));

  return { data, meta: { lowStockThreshold: LOW_STOCK_THRESHOLD } };
}

async function getOperationsSummary() {
  const [jobStatusRows, deviceStatusRows, simStatusRows, technicianTotal, technicianActive] = await Promise.all([
    Job.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Device.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Sim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Technician.countDocuments(),
    Technician.countDocuments({ active: true }),
  ]);

  const toCounts = (rows, keys) => {
    const counts = Object.fromEntries(keys.map((key) => [key, 0]));
    for (const row of rows) counts[row._id] = row.count;
    counts.total = rows.reduce((sum, row) => sum + row.count, 0);
    return counts;
  };

  return {
    jobs: toCounts(jobStatusRows, JOB_STATUSES),
    inventory: {
      devices: toCounts(deviceStatusRows, ['in_stock', 'assigned', 'out_of_service']),
      sims: toCounts(simStatusRows, ['in_stock', 'assigned', 'out_of_service']),
    },
    technicians: { total: technicianTotal, active: technicianActive },
  };
}

/* ------------------------------ Technicians ------------------------------ */

async function listTechnicians({ q, activeOnly = false } = {}) {
  const filter = {};
  if (activeOnly) filter.active = true;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { station: regex }];
  }

  const rows = await Technician.find(filter).sort({ name: 1 });
  return { data: rows.map((row) => row.toApiJson()) };
}

async function createTechnician(input, actor) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the technician’s name.');
  }
  if (typeof input.station !== 'string' || !input.station.trim()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the station this technician works from.');
  }

  const technician = new Technician({
    name: input.name.trim(),
    phone: input.phone?.trim(),
    station: input.station.trim(),
    notes: input.notes?.trim(),
    createdBy: actor.id,
  });

  await technician.save();
  return technician.toApiJson();
}

async function updateTechnician(id, input) {
  const technician = await Technician.findById(id);
  if (!technician) throw makeError(errorCodes.NOT_FOUND, 'No technician matches that id.');

  if (input.name !== undefined) technician.name = input.name.trim();
  if (input.phone !== undefined) technician.phone = input.phone.trim();
  if (input.station !== undefined) technician.station = input.station.trim();
  if (input.notes !== undefined) technician.notes = input.notes.trim();
  if (input.active !== undefined) technician.active = Boolean(input.active);

  await technician.save();
  return technician.toApiJson();
}

/* -------------------------------- Devices -------------------------------- */

async function listDevices({ status, q, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ imei: regex }, { model: regex }, { station: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total] = await Promise.all([
    Device.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).populate('technician', 'name station'),
    Device.countDocuments(filter),
  ]);

  return {
    data: rows.map((row) => {
      const json = row.toApiJson();
      json.technician = row.technician?._id ? { id: row.technician._id.toString(), name: row.technician.name } : null;
      return json;
    }),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

async function createDevice(input, actor) {
  const imei = String(input.imei ?? '').trim();
  if (!/^\d{14,17}$/.test(imei)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid IMEI (14 to 17 digits).');
  }
  if (await Device.exists({ imei })) {
    throw makeError(errorCodes.CONFLICT, 'A device with this IMEI is already in stock.', 409);
  }
  if (!input.station?.trim()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the station this device is held at.');
  }

  const device = new Device({
    imei,
    model: input.model?.trim(),
    station: input.station.trim(),
    notes: input.notes?.trim(),
    createdBy: actor.id,
  });

  await device.save();
  return device.toApiJson();
}

async function updateDevice(id, input) {
  const device = await Device.findById(id);
  if (!device) throw makeError(errorCodes.NOT_FOUND, 'No device matches that id.');
  if (device.job) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'This device is fitted to a job. Update the job to move it.');
  }

  const previousStation = device.station;
  const previousTechnician = device.technician;

  if (input.model !== undefined) device.model = input.model.trim();
  if (input.station !== undefined) device.station = input.station.trim();
  if (input.notes !== undefined) device.notes = input.notes.trim();
  if (input.status === 'out_of_service' || input.status === 'in_stock') device.status = input.status;

  /* Hand stock to a technician, or return it to the station. */
  if (input.technicianId !== undefined) {
    if (!input.technicianId) {
      device.technician = null;
      if (device.status === 'assigned') device.status = 'in_stock';
    } else {
      const technician = await Technician.findById(input.technicianId);
      if (!technician || !technician.active) {
        throw makeError(errorCodes.VALIDATION_ERROR, 'Choose an active technician.');
      }
      device.technician = technician._id;
      device.status = 'assigned';
    }
  }

  await device.save();

  if (previousStation && (previousStation !== device.station || device.status === 'out_of_service' || input.technicianId)) {
    await checkStationStock(previousStation);
  }

  const affectedTechnicians = new Set([previousTechnician, device.technician].filter(Boolean).map(String));
  for (const technicianId of affectedTechnicians) {
    await checkTechnicianStock(technicianId);
  }

  return device.toApiJson();
}

/* ---------------------------------- SIMs --------------------------------- */

async function listSims({ status, q, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ number: regex }, { iccid: regex }, { operator: regex }, { station: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  const [rows, total] = await Promise.all([
    Sim.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).populate('technician', 'name station'),
    Sim.countDocuments(filter),
  ]);

  return {
    data: rows.map((row) => {
      const json = row.toApiJson();
      json.technician = row.technician?._id ? { id: row.technician._id.toString(), name: row.technician.name } : null;
      return json;
    }),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

async function createSim(input, actor) {
  const number = String(input.number ?? '').trim();
  if (number.length < 6) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the SIM number as printed on the card.');
  }
  if (await Sim.exists({ number })) {
    throw makeError(errorCodes.CONFLICT, 'A SIM with this number is already in stock.', 409);
  }
  if (!input.station?.trim()) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the station this SIM is held at.');
  }

  const sim = new Sim({
    number,
    iccid: input.iccid?.trim(),
    operator: input.operator?.trim(),
    station: input.station.trim(),
    notes: input.notes?.trim(),
    createdBy: actor.id,
  });

  await sim.save();
  return sim.toApiJson();
}

async function updateSim(id, input) {
  const sim = await Sim.findById(id);
  if (!sim) throw makeError(errorCodes.NOT_FOUND, 'No SIM matches that id.');
  if (sim.job) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'This SIM is fitted to a job. Update the job to move it.');
  }

  if (input.iccid !== undefined) sim.iccid = input.iccid.trim();
  if (input.operator !== undefined) sim.operator = input.operator.trim();
  if (input.station !== undefined) sim.station = input.station.trim();
  if (input.notes !== undefined) sim.notes = input.notes.trim();
  if (input.status === 'out_of_service' || input.status === 'in_stock') sim.status = input.status;

  if (input.technicianId !== undefined) {
    if (!input.technicianId) {
      sim.technician = null;
      if (sim.status === 'assigned') sim.status = 'in_stock';
    } else {
      const technician = await Technician.findById(input.technicianId);
      if (!technician || !technician.active) {
        throw makeError(errorCodes.VALIDATION_ERROR, 'Choose an active technician.');
      }
      sim.technician = technician._id;
      sim.status = 'assigned';
    }
  }

  await sim.save();
  return sim.toApiJson();
}

export {
  listJobs,
  createJob,
  updateJob,
  getOperationsSummary,
  getStockByStation,
  getStockByTechnician,
  listTechnicians,
  createTechnician,
  updateTechnician,
  listDevices,
  createDevice,
  updateDevice,
  listSims,
  createSim,
  updateSim,
};
