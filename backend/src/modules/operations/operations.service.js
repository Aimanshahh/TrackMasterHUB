import Customer from '../../models/Customer.js';
import Device from '../../models/Device.js';
import Job, { JOB_STATUSES, jobStatusLabels } from '../../models/Job.js';
import Notification from '../../models/Notification.js';
import Sim from '../../models/Sim.js';
import Technician from '../../models/Technician.js';
import User from '../../models/User.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { createApprovalForJob } from '../approvals/approvals.service.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { getPackagePricing } from '../pricing/pricing.service.js';

/** A station is flagged when it has fewer available devices than this. */
import { CHECKLIST_ITEMS, CHECKLIST_KEYS, ENGINE_KILL_STATUSES, completionMissing, engineKillLabels } from '../../utils/installation.js';

export const LOW_STOCK_THRESHOLD = 3;

/** Do not repeat the same station warning within this window. */
const LOW_STOCK_ALERT_WINDOW_HOURS = 12;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pageParams(page, limit) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

function parseOptionalDate(value, label) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, `Enter a valid ${label}.`);
  return date;
}

function parseOptionalYear(value) {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid record year.');
  }
  return year;
}

function parseOptionalMonth(value) {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return null;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter an installation month from 1 to 12.');
  }
  return month;
}

/* ---------------------------------- Jobs --------------------------------- */

async function listJobs({ status, priority, q, technician, pending, awaitingApproval, page = 1, limit = 20 }) {
  const filter = {};

  if (status && JOB_STATUSES.includes(status)) filter.status = status;
  if (priority) filter.priority = priority;
  if (technician) filter.technician = technician;

  // Pending installations: vehicles that were sold and are not yet installed.
  // Follow-up records carry no vehicle work, so they never appear here.
  const onlyPending = pending === true || pending === 'true';
  if (onlyPending) {
    filter.requestType = 'new_installation';
    if (!filter.status) filter.status = { $nin: ['completed', 'cancelled'] };
  }
  if (awaitingApproval === true || awaitingApproval === 'true') filter.approvalStatus = 'pending';

  if (q) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ reference: regex }, { customerName: regex }, { phone: regex }, { 'vehicle.registration': regex }, { deviceImei: regex }, { simNumber: regex }];
  }

  const { page: safePage, limit: safeLimit, skip } = pageParams(page, limit);

  // The oldest waiting job comes first on the pending screen; everywhere else
  // the newest does.
  const sort = onlyPending ? { createdAt: 1 } : { createdAt: -1 };

  const [rows, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(safeLimit).populate('technician', 'name station'),
    Job.countDocuments(filter),
  ]);

  const meta = { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };

  if (onlyPending) {
    // Counts ignore the stage filter so the chips on the screen stay stable.
    const base = { requestType: 'new_installation', status: { $nin: ['completed', 'cancelled'] } };
    const [byStatus, approvalWaiting] = await Promise.all([
      Job.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Job.countDocuments({ ...base, approvalStatus: 'pending' }),
    ]);
    meta.counts = {
      all: byStatus.reduce((sum, row) => sum + row.count, 0),
      awaitingApproval: approvalWaiting,
      ...Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
    };
  }

  return { data: rows.map((job) => job.toApiJson()), meta };
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

  // A slot requested at intake is stored, not confirmed: operations still
  // assigns the technician and may move the appointment.
  let scheduledAt = null;
  if (input.scheduledAt) {
    scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid installation date and time.');
    }
  }

  /* Package and price. The rate is the admin's; the salesperson may quote at
     that rate, or below it when a discount needs approval. */
  let packageKey = null;
  let listPrice = null;
  let quotedPrice = null;
  let approvalStatus = 'not_required';

  if (requestType === 'new_installation') {
    if (!input.packageKey) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the package the customer is buying.');
    }

    const pricing = await getPackagePricing(input.packageKey);
    packageKey = pricing.key;
    listPrice = pricing.price;

    const quote = Number(input.quotedPrice);
    if (!Number.isFinite(quote) || quote <= 0) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the price you quoted the customer.');
    }

    quotedPrice = Math.round(quote * 100) / 100;

    // The package rate is the minimum selling price. Quoting at or above it
    // needs no approval; quoting below it goes to the admin.
    approvalStatus = quotedPrice < listPrice ? 'pending' : 'not_required';
  }

  const job = new Job({
    customer: customer._id,
    customerName: customer.name,
    phone: customer.phone ?? '',
    requestType,
    vehicle,
    priority: input.priority ?? 'normal',
    scheduledAt,
    notes: input.notes?.trim(),
    simMode: input.simMode?.trim(),
    loginId: input.loginId?.trim(),
    oldVrn: input.oldVrn?.trim(),
    installationDate: parseOptionalDate(input.installationDate, 'installation date'),
    installationMonth: parseOptionalMonth(input.installationMonth),
    recordYear: parseOptionalYear(input.recordYear),
    packageKey,
    listPrice,
    quotedPrice,
    approvalStatus,
    createdBy: actor.id,
    history: [
      {
        status: 'unassigned',
        note: scheduledAt
          ? 'Job created with a requested installation slot; operations confirms it.'
          : 'Job created and added to the operations queue.',
        at: new Date(),
        by: actor.id,
      },
    ],
  });

  await job.save();

  if (approvalStatus === 'pending') {
    const approval = await createApprovalForJob(
      {
        job,
        customerName: customer.name,
        packageKey,
        listPrice,
        quotedPrice,
        reason: input.approvalReason,
      },
      actor,
    );

    job.approval = approval._id;
    job.history.push({
      status: 'unassigned',
      note: `Quoted below the ${packageKey} package rate; sent to the admin for price approval.`,
      at: new Date(),
      by: actor.id,
    });
    await job.save();
  }

  return job.toApiJson();
}

async function releaseDevice(imei, jobId) {
  await Device.updateOne({ imei, job: jobId }, { $set: { status: 'in_stock' }, $unset: { job: 1, technician: 1 } });
}

async function releaseSim(number, jobId) {
  await Sim.updateOne({ number, job: jobId }, { $set: { status: 'in_stock' }, $unset: { job: 1, technician: 1 } });
}

const actorName = (actor) => String(actor?.name ?? actor?.email ?? '').trim();

const text = (value, label, max) => {
  const out = String(value ?? '').trim();
  if (out.length > max) throw makeError(errorCodes.VALIDATION_ERROR, `${label} can be at most ${max} characters.`);
  return out;
};

/** Applies the installation details Operations enters from the technician's report. Returns the labels of what changed. */
function applyInstallationDetails(job, input, actor) {
  const changed = [];
  const inst = job.installation;
  const fields = [
    ['deviceModel', 'Device model', 120],
    ['placement', 'Device location in vehicle', 160],
    ['address', 'Installation address', 400],
    ['testResult', 'Testing results', 1000],
    ['technicianRemarks', 'Technician remarks', 1000],
    ['operationsRemarks', 'Operations remarks', 1000],
  ];

  for (const [key, label, max] of fields) {
    if (input[key] === undefined) continue;
    const next = text(input[key], label, max);
    if (next !== (inst[key] ?? '')) { inst[key] = next; changed.push(label); }
  }

  if (input.batteryTemperatureC !== undefined) {
    const raw = input.batteryTemperatureC;
    const next = raw === null || raw === '' ? null : Number(raw);
    if (next !== null && (!Number.isFinite(next) || next < -50 || next > 150)) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Battery temperature must be a number between -50 and 150 °C.');
    }
    if (next !== (inst.batteryTemperatureC ?? null)) { inst.batteryTemperatureC = next; changed.push('Battery temperature'); }
  }

  for (const [key, label] of [['engineNo', 'Engine number'], ['chassisNo', 'Chassis number']]) {
    if (input[key] === undefined) continue;
    const next = text(input[key], label, 60);
    if (next !== (job.vehicle[key] ?? '')) { job.vehicle[key] = next; changed.push(label); }
  }

  if (changed.length) {
    job.history.push({ status: job.status, kind: 'details', note: `Installation details updated: ${changed.join(', ')}.`, at: new Date(), by: actor.id, byName: actorName(actor) });
  }

  if (input.checklist && typeof input.checklist === 'object') {
    const flips = [];
    for (const item of CHECKLIST_ITEMS) {
      if (input.checklist[item.key] === undefined) continue;
      const next = Boolean(input.checklist[item.key]);
      if (next !== Boolean(inst.checklist?.[item.key])) {
        inst.checklist[item.key] = next;
        flips.push({ key: item.key, label: item.label, value: next });
      }
    }
    if (flips.length) {
      inst.checklistUpdatedAt = new Date();
      job.history.push({
        status: job.status,
        kind: 'checklist',
        note: `Checklist updated: ${flips.map((f) => `${f.label} ${f.value ? '✓' : '✗'}`).join('; ')}.`,
        data: { changes: flips, checklist: Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, Boolean(inst.checklist[k])])) },
        at: new Date(),
        by: actor.id,
        byName: actorName(actor),
      });
      changed.push('Checklist');
    }
  }

  return changed;
}

/**
 * Engine kill is recorded on its own, separate from GPS installation status.
 * "Not implemented" needs a reason; every change is kept in engineKillHistory.
 */
function applyEngineKill(job, input, actor) {
  const status = input?.status;
  if (!ENGINE_KILL_STATUSES.includes(status) || status === 'not_set') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose Implemented or Not implemented for the engine kill.');
  }
  const reason = text(input.reason, 'Reason', 400);
  if (status === 'not_implemented' && !reason) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Give a reason when engine kill is not implemented.');
  }

  const current = job.installation.engineKill ?? {};
  const from = current.status ?? 'not_set';
  const nextReason = status === 'not_implemented' ? reason : reason; // keep any note on implemented too
  if (from === status && (current.reason ?? '') === nextReason) return false;

  const now = new Date();
  job.installation.engineKill = { status, reason: nextReason, updatedAt: now, updatedByName: actorName(actor) };
  job.engineKillHistory.push({ from, to: status, reason: nextReason, at: now, by: actor.id, byName: actorName(actor) });
  job.history.push({
    status: job.status,
    kind: 'engine_kill',
    note: `Engine kill ${engineKillLabels[status].toLowerCase()}${nextReason ? ` — ${nextReason}` : ''}.`,
    data: { from, to: status, reason: nextReason },
    at: now,
    by: actor.id,
    byName: actorName(actor),
  });
  return true;
}

async function updateEngineKill(id, input, actor) {
  const job = await Job.findById(id);
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No operations job matches that id.');
  if (job.requestType !== 'new_installation') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Engine kill is recorded on installation jobs only.');
  }
  if (job.status === 'cancelled') throw makeError(errorCodes.CONFLICT, 'This job was cancelled.', 409);
  applyEngineKill(job, input ?? {}, actor);
  await job.save();
  const refreshed = await Job.findById(job._id).populate('technician', 'name station');
  return refreshed.toApiJson();
}

async function updateJob(id, input, actor) {
  const job = await Job.findById(id);
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No operations job matches that id.');

  const previousStatus = job.status;

  /* Installation tests, device placement, remarks and engine kill belong to Operations (and the admin). */
  if (actor?.role === 'manager') {
    const operationsOnly = ['checklist', 'engineKill', 'deviceModel', 'placement', 'address', 'batteryTemperatureC', 'testResult', 'technicianRemarks', 'operationsRemarks', 'completedAt'];
    if (operationsOnly.some((key) => input[key] !== undefined)) {
      throw makeError(errorCodes.FORBIDDEN, 'Only Operations or the admin can change installation tests, device placement or engine kill.', 403);
    }
  }

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
  if (input.engineNo !== undefined) job.vehicle.engineNo = input.engineNo.trim();
  if (input.chassisNo !== undefined) job.vehicle.chassisNo = input.chassisNo.trim();
  if (input.colour !== undefined) job.vehicle.colour = input.colour.trim();
  if (input.priority !== undefined) job.priority = input.priority;
  if (input.notes !== undefined) job.notes = input.notes.trim();
  if (input.simMode !== undefined) job.simMode = String(input.simMode ?? '').trim();
  if (input.loginId !== undefined) job.loginId = String(input.loginId ?? '').trim();
  if (input.oldVrn !== undefined) job.oldVrn = String(input.oldVrn ?? '').trim();
  if (input.installationDate !== undefined) job.installationDate = parseOptionalDate(input.installationDate, 'installation date');
  if (input.installationMonth !== undefined) job.installationMonth = parseOptionalMonth(input.installationMonth);
  if (input.recordYear !== undefined) job.recordYear = parseOptionalYear(input.recordYear);
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
        if (!device && !job.legacy?.imported && job.status !== 'completed') {
          throw makeError(errorCodes.VALIDATION_ERROR, 'That IMEI is not recorded in device stock.');
        }
        if (device) {
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
        if (!sim && !job.legacy?.imported && job.status !== 'completed') {
          throw makeError(errorCodes.VALIDATION_ERROR, 'That SIM number is not recorded in SIM stock.');
        }
        if (sim) {
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
      }

      job.simNumber = number;
    }
  }

  /* Installation details, checklist and engine kill */
  const detailsTouched = applyInstallationDetails(job, input, actor).length > 0;
  let engineKillTouched = false;
  if (input.engineKill !== undefined) engineKillTouched = applyEngineKill(job, input.engineKill, actor);

  /* Status */
  const nextStatus = input.status ?? job.status;

  if (nextStatus !== previousStatus && ['assigned', 'scheduled', 'in_progress', 'completed'].includes(nextStatus) && !job.technician) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Assign a technician before moving this job forward.');
  }

  /* A discount is never completed on trust: the price must be approved first.
     Checked before stock so the desk sees the commercial blocker, not a
     downstream one. */
  if (nextStatus === 'completed' && ['pending', 'rejected'].includes(job.approvalStatus)) {
    throw makeError(
      errorCodes.CONFLICT,
      job.approvalStatus === 'pending'
        ? 'The quoted price is still waiting for the admin. This installation cannot be completed until it is approved.'
        : 'The quoted price was rejected. The salesperson must resubmit this request with an approved price.',
      409,
    );
  }

  if (nextStatus === 'completed' && job.requestType === 'new_installation' && (!job.deviceImei || !job.simNumber)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Record the device IMEI and SIM number before completing the installation.');
  }

  /* An installation is only complete when its essential details and applicable
     tests are on record. Opening the form, or ticking nothing, never completes it.
     Imported legacy vehicles are already installed and are not held to this. */
  if (
    nextStatus === 'completed' && job.requestType === 'new_installation' && !job.legacy?.imported
    && (previousStatus !== 'completed' || detailsTouched || engineKillTouched)
  ) {
    const missing = completionMissing(job);
    if (missing.length) {
      throw makeError(
        errorCodes.VALIDATION_ERROR,
        `This installation is not ready to complete. Still needed: ${missing.map((m) => m.label).join('; ')}.`,
        400,
        { missing },
      );
    }
  }

  job.status = nextStatus;

  if (nextStatus === 'completed' && previousStatus !== 'completed') job.completedAt = new Date();
  if (nextStatus === 'completed' && input.completedAt) {
    const when = new Date(input.completedAt);
    if (Number.isNaN(when.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid completion date and time.');
    if (when.getTime() > Date.now() + 5 * 60 * 1000) throw makeError(errorCodes.VALIDATION_ERROR, 'The completion time cannot be in the future.');
    job.completedAt = when;
  }
  if (nextStatus !== 'completed') job.completedAt = null;

  const statusChanged = nextStatus !== previousStatus;

  if (statusChanged || input.note) {
    job.history.push({
      status: nextStatus,
      note: input.note?.trim() || (statusChanged ? `Status moved to ${jobStatusLabels[nextStatus]}.` : ''),
      at: new Date(),
      by: actor.id,
      byName: actorName(actor),
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
      link: '/salesperson/requests',
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
  updateEngineKill,
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
