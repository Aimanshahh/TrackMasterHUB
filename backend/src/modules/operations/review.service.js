import Activity from '../../models/Activity.js';
import Device from '../../models/Device.js';
import Job, { jobStatusLabels } from '../../models/Job.js';
import MicrophoneNumber from '../../models/MicrophoneNumber.js';
import Sim from '../../models/Sim.js';
import Technician from '../../models/Technician.js';
import TechnicianEarning from '../../models/TechnicianEarning.js';
import User from '../../models/User.js';
import { packageCatalog } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { notifyUser } from '../notifications/notifications.service.js';
import Customer from '../../models/Customer.js';
import { env } from '../../config/env.js';
import { getDeviceTelemetry } from '../tracking/tracking.service.js';
import { packageHasEngineKill, suggestCustomerLogin } from '../../utils/customerLogin.js';
import { refreshPortals } from '../technician/portalCheck.js';

/** Packages that include the one-way microphone facility. */
export const MICROPHONE_PACKAGES = ['standard', 'premium'];

const nameOf = (actor) => String(actor?.name ?? actor?.email ?? '').trim();

const packageName = (key) => (key ? packageCatalog[key]?.name ?? key : '');

const money = (value) => `PKR ${Number(value ?? 0).toLocaleString()}`;

function testingSummary(job) {
  const t = job.testing ?? {};
  return {
    battery: t.battery?.status ?? 'pending',
    ignition: t.ignition?.status ?? 'pending',
    location: t.location?.status ?? 'pending',
    engineKill: t.engineKillTest?.status ?? 'not_requested',
    engineKillApplicable: packageHasEngineKill(job.packageKey),
    engineKillNote: t.engineKillTest?.requestNote ?? '',
    portalCheck: { at: t.portalCheck?.at?.toISOString?.() ?? null, message: t.portalCheck?.message ?? '' },
    submittedAt: t.submittedAt?.toISOString?.() ?? null,
    submittedByName: t.submittedByName ?? '',
    review: {
      status: t.review?.status ?? 'pending',
      byName: t.review?.byName ?? '',
      at: t.review?.at?.toISOString?.() ?? null,
      note: t.review?.note ?? '',
    },
  };
}

function reviewRow(job) {
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
    packageKey: job.packageKey ?? null,
    packageName: packageName(job.packageKey),
    technician: job.technician?.name
      ? { id: job.technician._id.toString(), name: job.technician.name, station: job.technician.station ?? '' }
      : null,
    deviceImei: job.deviceImei ?? '',
    simNumber: job.simNumber ?? '',
    status: job.status,
    statusLabel: jobStatusLabels[job.status] ?? job.status,
    scheduledAt: job.scheduledAt?.toISOString?.() ?? null,
    testing: testingSummary(job),
    microphone: {
      required: Boolean(job.microphone?.required),
      number: job.microphone?.number ?? '',
    },
    address: job.installation?.address ?? '',
    telemetry: job.deviceImei ? getDeviceTelemetry(job.deviceImei) : null,
    suggestedLogin: suggestCustomerLogin(job.vehicle?.registration),
    createdAt: job.createdAt.toISOString(),
  };
}

/** Installations the technician has submitted, newest submission first. */
async function listTestingQueue() {
  const jobs = await Job.find({ requestType: 'new_installation', 'testing.submittedAt': { $ne: null } })
    .sort({ 'testing.submittedAt': -1 })
    .limit(100)
    .populate('technician', 'name station');

  const pending = jobs.filter((job) => job.status !== 'completed' && job.testing?.review?.status !== 'approved');
  return {
    data: jobs.map(reviewRow),
    meta: {
      total: jobs.length,
      awaitingReview: pending.filter((job) => job.testing?.review?.status === 'pending').length,
    },
  };
}

/** Operations re-reads the portal while checking an installation. */
async function refreshReview(id) {
  const job = await loadForReview(id);
  await refreshPortals();
  return reviewRow(job);
}

async function loadForReview(id) {
  const job = await Job.findById(id).populate('technician', 'name station rates');
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No installation matches that id.');
  if (job.requestType !== 'new_installation') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Only installation jobs are reviewed here.');
  }
  return job;
}

/**
 * Operations decides on the technician submission. Approval is what closes the
 * installation, marks the stock installed, and creates the technician's earning
 * at the rate that applies at that moment.
 */
async function reviewInstallation(id, input, actor) {
  const decision = ['approve', 'reject', 'retest'].includes(input?.decision) ? input.decision : null;
  if (!decision) throw makeError(errorCodes.VALIDATION_ERROR, 'Choose approve, reject or request a retest.');

  const job = await loadForReview(id);
  if (job.status === 'cancelled') throw makeError(errorCodes.CONFLICT, 'This installation was cancelled.', 409);
  if (job.status === 'completed' && decision === 'approve') {
    throw makeError(errorCodes.CONFLICT, 'This installation is already approved.', 409);
  }
  if (!job.testing?.submittedAt) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The technician has not submitted this installation yet.');
  }

  const note = String(input?.note ?? '').trim().slice(0, 1000);
  const now = new Date();
  const who = nameOf(actor);

  if (decision === 'reject' || decision === 'retest') {
    if (!note) throw makeError(errorCodes.VALIDATION_ERROR, 'Add a note explaining what the technician must correct.');
    job.testing.review = { status: decision === 'reject' ? 'rejected' : 'retest', by: actor.id, byName: who, at: now, note };
    job.history.push({
      status: job.status,
      note: `Operations ${decision === 'reject' ? 'rejected' : 'requested a retest of'} the installation — ${note}`,
      at: now,
      by: actor.id,
      byName: who,
    });
    await job.save();

    /* Sent back for correction: the pair is reserved to this job again, not out in the field. */
    if (job.deviceImei) await Device.updateOne({ imei: job.deviceImei, job: job._id }, { $set: { status: 'assigned' }, $unset: { installedAt: 1 } });
    if (job.simNumber) await Sim.updateOne({ number: job.simNumber, job: job._id }, { $set: { status: 'assigned' }, $unset: { installedAt: 1 } });

    if (job.technician?.user) {
      await notifyUser({
        userId: job.technician.user,
        type: 'installation.reviewed',
        title: `Installation ${decision === 'reject' ? 'rejected' : 'needs a retest'} · ${job.reference}`,
        body: note,
        link: `/technician/installations/${job._id}`,
        meta: { reference: job.reference, recordId: job._id.toString(), status: decision, station: job.vehicle?.station ?? '' },
      });
    }

    return { job: reviewRow(await Job.findById(job._id).populate('technician', 'name station')), earning: null };
  }

  /* Approval: every required test must be verified, including the engine kill
     test that operations performs itself. */
  const missing = [];
  if (job.testing?.battery?.status !== 'verified') missing.push('battery / disconnect test');
  if (job.testing?.ignition?.status !== 'verified') missing.push('ignition test');
  if (job.testing?.location?.status !== 'verified') missing.push('location test');
  if (missing.length) {
    throw makeError(errorCodes.VALIDATION_ERROR, `These tests are still not verified by the technician: ${missing.join('; ')}.`);
  }
  /* Engine kill: nothing to test on Basic/Personal, or when the technician reported the
     vehicle cannot take one. Otherwise Operations has checked it on the portal. */
  const kill = job.testing.engineKillTest;
  if (packageHasEngineKill(job.packageKey) && kill.status !== 'not_supported' && kill.status !== 'verified') {
    if (!['requested', 'failed'].includes(kill.status)) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'The engine kill test has not been requested. Ask the technician to request it or note that the vehicle cannot take one.');
    }
    if (input?.restored === false) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Confirm the vehicle was restored after the engine kill test before approving.');
    }
    kill.status = 'verified';
    kill.verifiedAt = now;
    kill.verifiedByName = who;
    kill.activated = input?.activated !== false;
    kill.restored = true;
    kill.note = String(input?.engineKillNote ?? '').trim().slice(0, 500);
  }

  /* The customer's app login: VRN@domain with the shared starting password from the environment. */
  const customer = await Customer.findById(job.customer);
  if (customer && !customer.appLogin) {
    customer.appLogin = suggestCustomerLogin(job.vehicle?.registration);
    if (!customer.appPassword && env.customerAppDefaultPassword) customer.appPassword = env.customerAppDefaultPassword;
    if (customer.appLogin) {
      await customer.save();
      job.history.push({ status: 'completed', note: `Customer app login created: ${customer.appLogin}.`, at: now, by: actor.id, byName: who });
    }
  }

  job.testing.review = { status: 'approved', by: actor.id, byName: who, at: now, note };
  job.status = 'completed';
  job.completedAt = job.completedAt ?? now;
  job.installation.checklist.deviceInstalled = true;
  job.installation.checklist.devicePoweredOn = true;
  job.installation.checklist.immobilizationTested = true;
  job.installation.checklistUpdatedAt = now;
  job.microphone.required = MICROPHONE_PACKAGES.includes(job.packageKey);

  job.history.push({
    status: 'completed',
    note: `Installation approved by operations${note ? ` — ${note}` : ''}.`,
    at: now,
    by: actor.id,
    byName: who,
  });

  /* The device and SIM fitted here leave the technician's working stock. */
  if (job.deviceImei) {
    await Device.updateOne({ imei: job.deviceImei }, { $set: { status: 'installed', installedAt: now } });
  }
  if (job.simNumber) {
    await Sim.updateOne({ number: job.simNumber }, { $set: { status: 'installed', installedAt: now } });
  }

  /* Earning: the rate on the technician record at approval time is copied on. */
  let earning = null;
  const technician = job.technician;
  const rate = Number(technician?.rates?.normal);
  if (technician?._id && Number.isFinite(rate) && rate > 0) {
    earning = await TechnicianEarning.create({
      technician: technician._id,
      job: job._id,
      customerName: job.customerName ?? '',
      vehicleRegistration: job.vehicle?.registration ?? '',
      type: 'normal',
      rate,
      additional: Number(technician.rates?.additional) || 0,
      amount: rate + (Number(technician.rates?.additional) || 0),
      approvedBy: actor.id,
      approvedByName: who,
      earnedAt: now,
    });
    job.history.push({
      status: 'completed',
      note: `Technician earning recorded: ${money(earning.amount)}.`,
      at: now,
      by: actor.id,
      byName: who,
    });
  } else if (technician?._id) {
    job.history.push({
      status: 'completed',
      note: 'No installation rate is configured for this technician, so no earning was created.',
      at: now,
      by: actor.id,
      byName: who,
    });
  }

  await job.save();

  await Activity.create({
    actor: actor.id,
    type: 'customer.updated',
    label: `Installation approved ${job.reference}`,
    description: `${job.customerName ?? 'Customer'} · ${job.vehicle?.registration ?? ''} approved by ${who}.`,
  });

  /* The salesperson who pushed the request is told the outcome. */
  if (job.createdBy) {
    await notifyUser({
      userId: job.createdBy,
      type: 'installation.status_changed',
      title: `Installation completed · ${job.reference}`,
      body: `${job.customerName ?? 'Customer'} · ${job.vehicle?.registration ?? 'vehicle'} was installed and approved.`,
      link: '/salesperson/requests',
      meta: { reference: job.reference, recordId: job._id.toString(), status: 'completed', station: job.vehicle?.station ?? '' },
    });
  }

  /* Standard and Premium need a microphone number before operations can close. */
  if (job.microphone.required && !job.microphone.number) {
    const operations = await User.find({ role: 'operations', active: true }).select('_id');
    await Promise.all(operations.map((person) => notifyUser({
      userId: person._id,
      type: 'microphone.pending',
      title: `Microphone number needed · ${job.reference}`,
      body: `${job.customerName ?? 'Customer'} · ${packageName(job.packageKey)} includes the microphone. Assign a number to this vehicle.`,
      link: '/operations/microphones',
      meta: { reference: job.reference, recordId: job._id.toString(), status: 'pending', station: job.vehicle?.station ?? '' },
    })));
  }

  const refreshed = await Job.findById(job._id).populate('technician', 'name station');
  return { job: reviewRow(refreshed), earning: earning ? earning.toApiJson() : null };
}

/**
 * Operations may move a schedule, the address or the technician. Every change
 * is written to scheduleHistory before it is applied, so nothing is overwritten
 * silently, and the technician is told when their day changes.
 */
async function updateSchedule(id, input, actor) {
  const job = await Job.findById(id);
  if (!job) throw makeError(errorCodes.NOT_FOUND, 'No installation matches that id.');
  if (job.status === 'completed') throw makeError(errorCodes.CONFLICT, 'A completed installation cannot be rescheduled.', 409);
  if (job.status === 'cancelled') throw makeError(errorCodes.CONFLICT, 'A cancelled sale cannot be rescheduled.', 409);

  const now = new Date();
  const who = nameOf(actor);
  const reason = String(input?.reason ?? '').trim().slice(0, 500);
  const changes = [];
  let technicianChanged = false;
  let nextTechnicianId = null;

  if (input?.scheduledAt !== undefined) {
    const next = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (next && Number.isNaN(next.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid installation date and time.');
    const previous = job.scheduledAt?.toISOString?.() ?? '';
    if ((next?.toISOString() ?? '') !== previous) {
      job.scheduleHistory.push({ kind: 'schedule', from: previous, to: next?.toISOString() ?? '', reason, at: now, by: actor.id, byName: who });
      job.scheduledAt = next;
      changes.push(`date moved to ${next ? next.toISOString() : 'not scheduled'}`);
    }
  }

  if (input?.address !== undefined) {
    const next = String(input.address ?? '').trim().slice(0, 400);
    const previous = job.installation.address ?? '';
    if (next !== previous) {
      job.scheduleHistory.push({ kind: 'address', from: previous, to: next, reason, at: now, by: actor.id, byName: who });
      job.installation.address = next;
      changes.push('installation address updated');
    }
  }

  if (input?.technicianId !== undefined) {
    const nextId = input.technicianId || null;
    const previousId = job.technician?.toString() ?? '';
    if ((nextId ?? '') !== previousId) {
      let nextName = '';
      if (nextId) {
        const technician = await Technician.findById(nextId);
        if (!technician || !technician.active) throw makeError(errorCodes.VALIDATION_ERROR, 'Choose an active technician.');
        nextName = technician.name;
        nextTechnicianId = technician._id;
      }
      const previous = await Technician.findById(previousId).select('name');
      job.scheduleHistory.push({
        kind: 'technician',
        from: previous?.name ?? '',
        to: nextName,
        reason,
        at: now,
        by: actor.id,
        byName: who,
      });
      job.technician = nextTechnicianId;
      technicianChanged = true;
      changes.push(`technician changed to ${nextName || 'unassigned'}`);
    }
  }

  if (!changes.length) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Nothing changed. Update the date, address or technician.');
  }
  if (input?.scheduledAt !== undefined && job.scheduledAt && job.status === 'unassigned' && job.technician) {
    job.status = 'scheduled';
  }

  job.history.push({ status: job.status, note: `Operations updated the schedule: ${changes.join(', ')}${reason ? ` — ${reason}` : ''}.`, at: now, by: actor.id, byName: who });
  await job.save();

  if (job.technician && (technicianChanged || input?.scheduledAt !== undefined)) {
    const technician = await Technician.findById(job.technician).select('user name');
    if (technician?.user) {
      await notifyUser({
        userId: technician.user,
        type: 'installation.assigned',
        title: `Installation schedule updated · ${job.reference}`,
        body: `${job.customerName ?? 'Customer'} · ${job.vehicle?.registration ?? ''} — ${changes.join(', ')}.`,
        link: `/technician/installations/${job._id}`,
        meta: { reference: job.reference, recordId: job._id.toString(), status: job.status, station: job.vehicle?.station ?? '' },
      });
    }
  }

  const refreshed = await Job.findById(job._id).populate('technician', 'name station');
  return reviewRow(refreshed);
}

/* ---------------------------------------------------------------- microphones */

async function listMicrophones() {
  const rows = await MicrophoneNumber.find()
    .sort({ status: 1, number: 1 })
    .populate('customer', 'name phone')
    .populate('job', 'reference');
  return {
    data: rows.map((row) => row.toApiJson()),
    meta: {
      available: rows.filter((row) => row.status === 'available').length,
      assigned: rows.filter((row) => row.status === 'assigned').length,
      retired: rows.filter((row) => row.status === 'retired').length,
    },
  };
}

async function createMicrophone(input, actor) {
  const number = String(input?.number ?? '').trim();
  if (!number) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the microphone number.');
  if (await MicrophoneNumber.exists({ number })) {
    throw makeError(errorCodes.CONFLICT, 'That microphone number is already in the inventory.', 409);
  }
  const row = await MicrophoneNumber.create({
    number,
    label: String(input?.label ?? '').trim().slice(0, 120),
    notes: String(input?.notes ?? '').trim().slice(0, 500),
    createdBy: actor.id,
  });
  return row.toApiJson();
}

/** A microphone number can only ever be active on one vehicle at a time. */
async function assignMicrophone(id, input, actor) {
  const job = await Job.findById(input?.jobId);
  if (!job) throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the customer installation this number belongs to.');
  if (!MICROPHONE_PACKAGES.includes(job.packageKey)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Microphone numbers are only for the Standard and Premium packages.');
  }
  if (job.microphone?.number) {
    throw makeError(errorCodes.CONFLICT, 'This vehicle already has a microphone number. Change it instead of assigning a second one.', 409);
  }

  const row = await MicrophoneNumber.findById(id);
  if (!row) throw makeError(errorCodes.NOT_FOUND, 'No microphone number matches that id.');
  if (row.status !== 'available') {
    throw makeError(errorCodes.CONFLICT, 'That number is not available.', 409);
  }

  const now = new Date();
  row.status = 'assigned';
  row.customer = job.customer;
  row.job = job._id;
  row.assignedAt = now;
  row.assignedBy = actor.id;
  row.assignedByName = nameOf(actor);
  row.history.push({ action: 'assigned', customer: job.customer, customerName: job.customerName ?? '', job: job._id, at: now, byName: nameOf(actor), note: String(input?.note ?? '').trim().slice(0, 500) });
  await row.save();

  job.microphone.number = row.number;
  job.microphone.required = true;
  job.microphone.assignedAt = now;
  job.microphone.assignedBy = actor.id;
  job.microphone.assignedByName = nameOf(actor);
  job.history.push({ status: job.status, note: `Microphone number ${row.number} assigned to this vehicle.`, at: now, by: actor.id, byName: nameOf(actor) });
  await job.save();

  return { microphone: row.toApiJson(), job: reviewRow(await Job.findById(job._id).populate('technician', 'name station')) };
}

async function releaseMicrophone(id, input, actor) {
  const row = await MicrophoneNumber.findById(id);
  if (!row) throw makeError(errorCodes.NOT_FOUND, 'No microphone number matches that id.');
  if (row.status !== 'assigned') throw makeError(errorCodes.CONFLICT, 'That number is not assigned to anyone.', 409);

  const now = new Date();
  const job = row.job ? await Job.findById(row.job) : null;

  row.history.push({ action: 'unassigned', customer: row.customer, customerName: job?.customerName ?? '', job: row.job, at: now, byName: nameOf(actor), note: String(input?.note ?? '').trim().slice(0, 500) });
  row.status = 'available';
  row.customer = undefined;
  row.job = undefined;
  row.assignedAt = undefined;
  row.assignedBy = undefined;
  row.assignedByName = '';
  await row.save();

  if (job) {
    job.microphone.number = '';
    job.microphone.assignedAt = undefined;
    job.history.push({ status: job.status, note: `Microphone number ${row.number} released.`, at: now, by: actor.id, byName: nameOf(actor) });
    await job.save();
  }

  return row.toApiJson();
}

/** Installations that still owe a microphone number. */
async function microphoneTasks() {
  const jobs = await Job.find({
    requestType: 'new_installation',
    status: 'completed',
    'microphone.required': true,
    'microphone.number': '',
  }).sort({ completedAt: -1 }).populate('technician', 'name station');

  return { data: jobs.map(reviewRow), meta: { pending: jobs.length } };
}

/* ------------------------------------------------------- technician rates */

async function updateTechnicianRates(id, input, actor) {
  const technician = await Technician.findById(id);
  if (!technician) throw makeError(errorCodes.NOT_FOUND, 'No technician matches that id.');

  const readRate = (value, label) => {
    if (value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw makeError(errorCodes.VALIDATION_ERROR, `${label} must be a number of 0 or more.`);
    return Math.round(number * 100) / 100;
  };

  if (input?.normal !== undefined) technician.rates.normal = readRate(input.normal, 'Normal installation rate');
  if (input?.redo !== undefined) technician.rates.redo = readRate(input.redo, 'Redo installation rate');
  if (input?.additional !== undefined) technician.rates.additional = readRate(input.additional, 'Additional charges') ?? 0;
  if (input?.remarks !== undefined) technician.rates.remarks = String(input.remarks ?? '').trim().slice(0, 400);
  if (input?.effectiveFrom !== undefined) {
    const when = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    if (Number.isNaN(when.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid effective date.');
    technician.rates.effectiveFrom = when;
  }
  technician.rates.updatedAt = new Date();
  technician.rates.updatedBy = actor.id;
  await technician.save();

  await Activity.create({
    actor: actor.id,
    type: 'pricing.updated',
    label: `Installation rates updated for ${technician.name}`,
    description: `Normal ${money(technician.rates.normal ?? 0)} · Redo ${money(technician.rates.redo ?? 0)} · Additional ${money(technician.rates.additional ?? 0)}.`,
  });

  return technician.toApiJson();
}

export {
  refreshReview,
  listTestingQueue,
  reviewInstallation,
  updateSchedule,
  listMicrophones,
  createMicrophone,
  assignMicrophone,
  releaseMicrophone,
  microphoneTasks,
  updateTechnicianRates,
};
