import Device, { USABLE_DEVICE_STATUSES } from '../../models/Device.js';
import Job, { jobStatusLabels } from '../../models/Job.js';
import Sim from '../../models/Sim.js';
import Technician from '../../models/Technician.js';
import TechnicianEarning from '../../models/TechnicianEarning.js';
import TechnicianPayment from '../../models/TechnicianPayment.js';
import User from '../../models/User.js';
import { packageCatalog } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { getDeviceTelemetry } from '../tracking/tracking.service.js';
import { packageHasEngineKill } from '../../utils/customerLogin.js';
import { applyTelemetry, refreshPortals, settleTests } from './portalCheck.js';

const ACTIVE_JOB_STATUSES = ['assigned', 'scheduled', 'in_progress'];

const nameOf = (user) => String(user?.name ?? user?.email ?? '').trim();

/** The technician record behind the signed-in login. Never trust a client id. */
async function currentTechnician(user) {
  if (!user) throw makeError(errorCodes.AUTHENTICATION_REQUIRED, 'Sign in first.', 401);
  const technician = await Technician.findOne({ user: user.id });
  if (!technician) {
    throw makeError(errorCodes.FORBIDDEN, 'This login is not linked to a technician record. Ask the admin to link it.', 403);
  }
  if (!technician.active) {
    throw makeError(errorCodes.FORBIDDEN, 'This technician account is deactivated.', 403);
  }
  return technician;
}

async function loadJob(technician, id) {
  const job = await Job.findById(id).populate('technician', 'name station');
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No installation matches that id.');
  if (job.technician?._id?.toString() !== technician._id.toString()) {
    throw makeError(errorCodes.FORBIDDEN, 'That installation is not assigned to you.', 403);
  }
  return job;
}

function jobRow(job) {
  return {
    id: job._id.toString(),
    reference: job.reference,
    customerName: job.customerName ?? '',
    phone: job.phone ?? '',
    vehicle: {
      label: job.vehicle?.label ?? '',
      registration: job.vehicle?.registration ?? '',
      station: job.vehicle?.station ?? '',
    },
    packageName: job.packageKey ? packageCatalog[job.packageKey]?.name ?? job.packageKey : '',
    status: job.status,
    statusLabel: jobStatusLabels[job.status] ?? job.status,
    priority: job.priority,
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    installedAt: job.installationDate?.toISOString() ?? null,
    deviceImei: job.deviceImei ?? '',
    simNumber: job.simNumber ?? '',
    notes: job.notes ?? '',
    reviewStatus: job.testing?.review?.status ?? 'pending',
    submittedAt: job.testing?.submittedAt?.toISOString() ?? null,
    testing: {
      battery: job.testing?.battery?.status ?? 'pending',
      ignition: job.testing?.ignition?.status ?? 'pending',
      location: job.testing?.location?.status ?? 'pending',
      engineKill: job.testing?.engineKillTest?.status ?? 'not_requested',
    },
    completedAt: job.completedAt?.toISOString() ?? null,
    address: job.installation?.address ?? '',
  };
}

/** Shortest edit distance, used only to explain a mistyped IMEI or SIM. */
function editDistance(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  const rows = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[s.length][t.length];
}

function hintFor(value, candidates) {
  const near = candidates
    .map((candidate) => ({ candidate, distance: editDistance(value, candidate) }))
    .filter((entry) => entry.distance > 0 && entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance)[0];
  return near ? ` The closest number in your stock is ${near.candidate}.` : '';
}

async function getSummary(user) {
  const technician = await currentTechnician(user);
  const jobs = await Job.find({ technician: technician._id, requestType: 'new_installation', status: { $in: ACTIVE_JOB_STATUSES } })
    .sort({ scheduledAt: 1, createdAt: 1 });

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const dueToday = jobs.filter((job) => job.scheduledAt && job.scheduledAt >= startOfDay && job.scheduledAt < endOfDay);

  const [deviceCount, simCount, awaitingReview] = await Promise.all([
    Device.countDocuments({ technician: technician._id, status: { $in: USABLE_DEVICE_STATUSES } }),
    Sim.countDocuments({ technician: technician._id, status: { $in: USABLE_DEVICE_STATUSES } }),
    Job.countDocuments({ technician: technician._id, 'testing.review.status': 'pending', 'testing.submittedAt': { $ne: null } }),
  ]);

  return {
    technician: technician.toApiJson(),
    counts: {
      openInstallations: jobs.length,
      dueToday: dueToday.length,
      awaitingReview,
      devicesInStock: deviceCount,
      simsInStock: simCount,
    },
    today: dueToday.map(jobRow),
    next: jobs.filter((job) => !dueToday.includes(job)).slice(0, 5).map(jobRow),
  };
}

async function listJobs(user, { status, page = 1, limit = 20 } = {}) {
  const technician = await currentTechnician(user);
  const filter = { technician: technician._id, requestType: 'new_installation' };
  if (status === 'open') filter.status = { $in: ACTIVE_JOB_STATUSES };
  else if (status && Object.keys(jobStatusLabels).includes(status)) filter.status = status;

  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);

  const [rows, total] = await Promise.all([
    Job.find(filter).sort({ scheduledAt: 1, createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
    Job.countDocuments(filter),
  ]);

  return {
    data: rows.map(jobRow),
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

async function getJob(user, id) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);

  const [devices, sims] = await Promise.all([
    Device.find({ technician: technician._id, status: { $in: USABLE_DEVICE_STATUSES } })
      .sort({ imei: 1 })
      .select('imei model status installedAt'),
    Sim.find({ technician: technician._id, status: { $in: USABLE_DEVICE_STATUSES } })
      .sort({ number: 1 })
      .select('number operator status iccid'),
  ]);

  return {
    /* Money is never sent to the technician's portal. */
    job: job.toApiJson({ includeFinancials: false }),
    telemetry: job.deviceImei ? getDeviceTelemetry(job.deviceImei) : null,
    stock: {
      devices: devices.filter((device) => !device.job || device.job.toString() === job._id.toString()).map((device) => ({
        id: device._id.toString(),
        imei: device.imei,
        model: device.model ?? '',
        status: device.status,
      })),
      sims: sims.filter((sim) => !sim.job || sim.job.toString() === job._id.toString()).map((sim) => ({
        id: sim._id.toString(),
        number: sim.number,
        operator: sim.operator ?? '',
        status: sim.status,
      })),
    },
  };
}

/**
 * The technician confirms which device and SIM they fitted. Both values must
 * match their own assigned stock exactly — a single wrong digit is rejected,
 * and the device can never be taken from another technician or another job.
 */
async function selectStock(user, id, input) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);

  if (job.status === 'completed' || job.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This installation is closed and its device can no longer be changed.', 409);
  }

  const imei = String(input?.imei ?? '').trim();
  const simNumber = String(input?.simNumber ?? '').trim();
  if (!imei) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the IMEI of the device you are fitting.');
  if (!simNumber) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the SIM number fitted with the device.');

  const ownDevices = await Device.find({ technician: technician._id });
  const device = ownDevices.find((row) => row.imei === imei);
  if (!device) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      `That IMEI does not match a device assigned to your stock.${hintFor(imei, ownDevices.map((row) => row.imei))}`,
    );
  }
  if (!USABLE_DEVICE_STATUSES.includes(device.status)) {
    throw makeError(errorCodes.CONFLICT, `That device is marked ${device.status.replace('_', ' ')} and cannot be installed.`, 409);
  }
  if (device.job && device.job.toString() !== job._id.toString()) {
    throw makeError(errorCodes.CONFLICT, 'That device is reserved for another installation.', 409);
  }

  const ownSims = await Sim.find({ technician: technician._id });
  const sim = ownSims.find((row) => row.number === simNumber);
  if (!sim) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      `That SIM number does not match a SIM assigned to your stock.${hintFor(simNumber, ownSims.map((row) => row.number))}`,
    );
  }
  if (!USABLE_DEVICE_STATUSES.includes(sim.status)) {
    throw makeError(errorCodes.CONFLICT, `That SIM is marked ${sim.status.replace('_', ' ')} and cannot be installed.`, 409);
  }
  if (sim.job && sim.job.toString() !== job._id.toString()) {
    throw makeError(errorCodes.CONFLICT, 'That SIM is reserved for another installation.', 409);
  }

  /* Moving this job to different stock puts the previous pair back in stock. */
  if (job.deviceImei && job.deviceImei !== imei) {
    await Device.updateOne(
      { imei: job.deviceImei, job: job._id },
      { $set: { status: 'in_stock' }, $unset: { job: 1 } },
    );
  }
  if (job.simNumber && job.simNumber !== simNumber) {
    await Sim.updateOne(
      { number: job.simNumber, job: job._id },
      { $set: { status: 'in_stock' }, $unset: { job: 1 } },
    );
  }

  const now = new Date();
  device.status = 'assigned';
  device.job = job._id;
  device.simNumber = simNumber;
  device.assignedAt = device.assignedAt ?? now;
  await device.save();

  sim.status = 'assigned';
  sim.job = job._id;
  sim.deviceImei = imei;
  sim.assignedAt = sim.assignedAt ?? now;
  await sim.save();

  job.deviceImei = imei;
  job.simNumber = simNumber;
  if (job.status === 'assigned' || job.status === 'scheduled') job.status = 'in_progress';
  job.history.push({
    status: job.status,
    kind: 'details',
    note: `Device ${imei} and SIM ${simNumber} selected from technician stock.`,
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();

  return (await getJob(user, id));
}

/**
 * Reads the installed device from the tracking portal by its IMEI. Location,
 * ignition and battery disconnect are portal results, never typed in.
 */
async function runPortalCheck(user, id) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This installation is closed.', 409);
  }
  if (!job.deviceImei) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Select your device first so it can be read from the tracking portal.');
  }

  await refreshPortals();
  const now = new Date();
  const check = applyTelemetry(job, getDeviceTelemetry(job.deviceImei), now);
  job.history.push({
    status: job.status,
    kind: 'checklist',
    note: check.found && !check.stale ? 'Device read from the tracking portal.' : `Portal check: ${check.message}`,
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();
  return getJob(user, id);
}

/**
 * The technician only adds what the portal cannot know: where the device was
 * fitted. A manual battery/ignition result is accepted only when the portal
 * does not expose that measure for this device.
 */
async function saveTest(user, id, input) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This installation is closed.', 409);
  }

  const key = ['battery', 'ignition', 'location'].find((entry) => input?.[entry] && typeof input[entry] === 'object');
  if (!key) throw makeError(errorCodes.VALIDATION_ERROR, 'Choose which test to record.');
  const payload = input[key];
  const now = new Date();
  const target = job.testing[key];

  if (key === 'location') {
    const address = String(payload.physicalLocation ?? '').trim().slice(0, 400);
    if (!address) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the physical location where the device was fitted.');
    target.physicalLocation = address;
    target.note = String(payload.note ?? target.note ?? '').trim().slice(0, 500);
    job.installation.address = address;
    if (!job.installation.placement) job.installation.placement = 'Recorded during installation';
    settleTests(job, now);
  } else {
    const telemetry = job.deviceImei ? getDeviceTelemetry(job.deviceImei) : { found: false };
    const exposed = key === 'battery' ? telemetry.batteryConnected : telemetry.ignitionOn;
    if (!telemetry.found || (exposed !== null && exposed !== undefined)) {
      throw makeError(
        errorCodes.VALIDATION_ERROR,
        key === 'battery'
          ? 'Battery disconnect is read from the tracking portal. Use "Check now".'
          : 'Ignition is read from the tracking portal. Use "Check now".',
      );
    }
    const status = payload.status === 'verified' || payload.status === 'failed' ? payload.status : null;
    if (!status) throw makeError(errorCodes.VALIDATION_ERROR, 'Record whether the test passed or failed.');
    target.status = status;
    target.source = 'manual';
    target.note = String(payload.note ?? '').trim().slice(0, 500);
    target.verifiedAt = now;
    target.verifiedByName = nameOf(user);
  }

  job.history.push({
    status: job.status,
    kind: 'checklist',
    note: `${key.charAt(0).toUpperCase() + key.slice(1)} test updated.`,
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();
  return getJob(user, id);
}

/** The technician states this vehicle cannot take an engine kill. */
async function markEngineKillUnsupported(user, id, input) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This installation is closed.', 409);
  }
  if (!packageHasEngineKill(job.packageKey)) {
    throw makeError(errorCodes.CONFLICT, 'This package does not include an engine kill, so nothing needs recording.', 409);
  }
  const note = String(input?.note ?? '').trim().slice(0, 500);
  if (!note) throw makeError(errorCodes.VALIDATION_ERROR, 'Add a note explaining why this vehicle cannot take an engine kill.');

  const now = new Date();
  Object.assign(job.testing.engineKillTest, {
    status: 'not_supported',
    requestNote: note,
    requestedAt: now,
    requestedByName: nameOf(user),
  });
  job.history.push({
    status: job.status,
    kind: 'engine_kill',
    note: `Technician reported this vehicle cannot take an engine kill — ${note}`,
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();
  return getJob(user, id);
}

/** Engine immobilization is only ever requested here; operations performs it. */
async function requestEngineKillTest(user, id, input) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw makeError(errorCodes.CONFLICT, 'This installation is closed.', 409);
  }

  if (!packageHasEngineKill(job.packageKey)) {
    throw makeError(errorCodes.CONFLICT, 'This package does not include an engine kill.', 409);
  }

  const now = new Date();
  job.testing.engineKillTest.status = 'requested';
  job.testing.engineKillTest.requestedAt = now;
  job.testing.engineKillTest.requestedByName = nameOf(user);
  job.testing.engineKillTest.requestNote = String(input?.note ?? '').trim().slice(0, 500);

  job.history.push({
    status: job.status,
    kind: 'engine_kill',
    note: `Engine kill test requested by the technician${job.testing.engineKillTest.requestNote ? ` — ${job.testing.engineKillTest.requestNote}` : ''}.`,
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();

  const operations = await User.find({ role: 'operations', active: true }).select('_id');
  await Promise.all(operations.map((person) => notifyUser({
    userId: person._id,
    type: 'installation.submitted',
    title: `Engine kill test requested · ${job.reference}`,
    body: `${job.customerName ?? 'Customer'} · ${job.vehicle?.registration ?? 'vehicle'} — coordinate the kill and restore test with the technician.`,
    link: '/operations/reviews',
    meta: { reference: job.reference, recordId: job._id.toString(), status: 'engine_kill_requested', station: job.vehicle?.station ?? '' },
  })));

  return getJob(user, id);
}

/** Submitting sends the installation to Operations; the technician cannot approve it. */
async function submitForReview(user, id) {
  const technician = await currentTechnician(user);
  const job = await loadJob(technician, id);

  if (job.status === 'completed') throw makeError(errorCodes.CONFLICT, 'This installation is already approved.', 409);
  if (job.status === 'cancelled') throw makeError(errorCodes.CONFLICT, 'This installation was cancelled.', 409);
  if (!job.deviceImei || !job.simNumber) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Select your device and SIM before submitting the installation.');
  }

  const missing = [];
  if (job.testing?.battery?.status !== 'verified') missing.push('battery disconnect check (use "Check now" while disconnecting and reconnecting the battery)');
  if (job.testing?.ignition?.status !== 'verified') missing.push('ignition check (the portal must see ignition ON and OFF)');
  if (job.testing?.location?.status !== 'verified') missing.push('geolocation check (the portal must report a position and you must enter where it was fitted)');
  if (packageHasEngineKill(job.packageKey) && !['requested', 'verified', 'not_supported'].includes(job.testing?.engineKillTest?.status)) {
    missing.push('engine kill (call Operations to test it, or note that this vehicle cannot take one)');
  }
  if (missing.length) {
    throw makeError(errorCodes.VALIDATION_ERROR, `Still needed before submitting: ${missing.join('; ')}.`);
  }

  const now = new Date();
  job.testing.submittedAt = now;
  job.testing.submittedByName = nameOf(user);
  job.testing.review.status = 'pending';
  job.testing.review.note = '';
  job.status = 'in_progress';

  job.history.push({
    status: job.status,
    note: 'Installation submitted by the technician for operations approval.',
    at: now,
    by: user.id,
    byName: nameOf(user),
  });
  await job.save();

  const operations = await User.find({ role: 'operations', active: true }).select('_id');
  await Promise.all(operations.map((person) => notifyUser({
    userId: person._id,
    type: 'installation.submitted',
    title: `Installation submitted · ${job.reference}`,
    body: `${job.customerName ?? 'Customer'} · ${job.vehicle?.registration ?? 'vehicle'} is ready for your testing review.`,
    link: '/operations/reviews',
    meta: { reference: job.reference, recordId: job._id.toString(), status: 'submitted', station: job.vehicle?.station ?? '' },
  })));

  return getJob(user, id);
}

async function getStock(user) {
  const technician = await currentTechnician(user);
  const [devices, sims] = await Promise.all([
    Device.find({ technician: technician._id }).sort({ status: 1, imei: 1 }),
    Sim.find({ technician: technician._id }).sort({ status: 1, number: 1 }),
  ]);

  return {
    technician: technician.toApiJson(),
    devices: devices.map((device) => ({
      id: device._id.toString(),
      imei: device.imei,
      model: device.model ?? '',
      status: device.status,
      statusLabel: device.toApiJson().statusLabel,
      job: device.job?.toString() ?? null,
      installedAt: device.installedAt?.toISOString() ?? null,
    })),
    sims: sims.map((sim) => ({
      id: sim._id.toString(),
      number: sim.number,
      operator: sim.operator ?? '',
      status: sim.status,
      statusLabel: sim.toApiJson().statusLabel,
      job: sim.job?.toString() ?? null,
      installedAt: sim.installedAt?.toISOString() ?? null,
    })),
    counts: {
      devicesAvailable: devices.filter((device) => USABLE_DEVICE_STATUSES.includes(device.status) && !device.job).length,
      simsAvailable: sims.filter((sim) => USABLE_DEVICE_STATUSES.includes(sim.status) && !sim.job).length,
      devicesInstalled: devices.filter((device) => device.status === 'installed').length,
      simsInstalled: sims.filter((sim) => sim.status === 'installed').length,
    },
  };
}

async function getEarnings(user) {
  const technician = await currentTechnician(user);
  const [earnings, payments] = await Promise.all([
    TechnicianEarning.find({ technician: technician._id }).sort({ earnedAt: -1, createdAt: -1 }).limit(100),
    TechnicianPayment.find({ technician: technician._id }).sort({ paidAt: -1 }).limit(100),
  ]);

  const earned = earnings.filter((row) => !row.reversed).reduce((sum, row) => sum + row.amount, 0);
  const paid = payments.reduce((sum, row) => sum + row.amount, 0);
  const normal = earnings.filter((row) => !row.reversed && row.type === 'normal');
  const redo = earnings.filter((row) => !row.reversed && row.type === 'redo');

  return {
    rates: {
      normal: technician.rates?.normal ?? null,
      redo: technician.rates?.redo ?? null,
      additional: technician.rates?.additional ?? 0,
      effectiveFrom: technician.rates?.effectiveFrom?.toISOString() ?? null,
      remarks: technician.rates?.remarks ?? '',
    },
    totals: {
      earned,
      paid,
      balance: Math.max(0, Math.round((earned - paid) * 100) / 100),
      installations: earnings.filter((row) => !row.reversed).length,
      normalCount: normal.length,
      redoCount: redo.length,
      normalAmount: normal.reduce((sum, row) => sum + row.amount, 0),
      redoAmount: redo.reduce((sum, row) => sum + row.amount, 0),
      additional: earnings.filter((row) => !row.reversed).reduce((sum, row) => sum + (row.additional ?? 0), 0),
    },
    earnings: earnings.map((row) => row.toApiJson()),
    payments: payments.map((row) => row.toApiJson()),
  };
}

export {
  currentTechnician,
  getSummary,
  listJobs,
  getJob,
  selectStock,
  saveTest,
  runPortalCheck,
  markEngineKillUnsupported,
  requestEngineKillTest,
  submitForReview,
  getStock,
  getEarnings,
};
