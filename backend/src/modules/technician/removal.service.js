import mongoose from 'mongoose';

import Device from '../../models/Device.js';
import DeviceRemoval from '../../models/DeviceRemoval.js';
import Job from '../../models/Job.js';
import Sim from '../../models/Sim.js';
import Technician from '../../models/Technician.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { recordActivity } from '../activity/activity.log.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameOf = (user) => String(user?.name ?? user?.email ?? '').trim();

/** A device counts as on the vehicle once the technician has submitted it, until it is removed. */
const ON_VEHICLE = {
  requestType: 'new_installation',
  'deviceRemoval.removal': { $exists: false },
  deviceImei: { $exists: true, $ne: '' },
  $or: [{ status: 'completed' }, { status: 'in_progress', 'testing.submittedAt': { $exists: true } }],
};

async function currentTechnician(user) {
  const technician = await Technician.findOne({ user: user?.id });
  if (!technician || !technician.active) {
    throw makeError(errorCodes.FORBIDDEN, 'This login is not linked to an active technician record.', 403);
  }
  return technician;
}

const vehicleRow = (job) => ({
  jobId: job._id.toString(),
  reference: job.reference,
  registration: job.vehicle?.registration ?? '',
  vehicleLabel: job.vehicle?.label ?? '',
  customerName: job.customerName ?? '',
  phone: job.phone ?? '',
  imei: job.deviceImei ?? '',
  simNumber: job.simNumber ?? '',
  installedAt: (job.completedAt ?? job.testing?.submittedAt ?? job.updatedAt)?.toISOString?.() ?? null,
});

/** Vehicles that currently carry one of our devices, found by plate, customer, phone or IMEI. */
export async function searchInstalledVehicles(user, q) {
  await currentTechnician(user);
  const text = String(q ?? '').trim();
  if (text.length < 2) return [];
  const loose = [...text.replace(/[^A-Za-z0-9]/g, '')].map(escapeRegex).join('[^A-Za-z0-9]*');
  const regex = new RegExp(escapeRegex(text), 'i');
  const jobs = await Job.find({
    ...ON_VEHICLE,
    $and: [{ $or: [
      { 'vehicle.registration': new RegExp(loose, 'i') },
      { customerName: regex }, { phone: regex }, { deviceImei: regex }, { 'vehicle.label': regex },
    ] }],
  }).sort({ completedAt: -1 }).limit(20);
  return jobs.map(vehicleRow);
}

/** Confirms a removal: device (and its SIM) back into the remover's stock, once. */
export async function confirmRemoval(user, input) {
  const technician = await currentTechnician(user);
  const jobId = String(input?.jobId ?? '');
  if (!mongoose.isValidObjectId(jobId)) throw makeError(errorCodes.VALIDATION_ERROR, 'Choose the vehicle the device is being removed from.');

  const job = await Job.findById(jobId);
  if (!job || job.requestType !== 'new_installation') throw makeError(errorCodes.NOT_FOUND, 'No vehicle matches that record.', 404);
  if (job.deviceRemoval?.removal) throw makeError(errorCodes.CONFLICT, 'The device on this vehicle was already removed.', 409);

  const typed = String(input?.imei ?? '').trim();
  const imei = job.deviceImei || typed;
  if (!/^\d{14,17}$/.test(imei)) throw makeError(errorCodes.VALIDATION_ERROR, 'This vehicle has no device recorded. Enter the IMEI of the device you removed (14 to 17 digits).');
  if (job.deviceImei && typed && typed !== job.deviceImei) {
    throw makeError(errorCodes.VALIDATION_ERROR, `This vehicle carries ${job.deviceImei}, not ${typed}. Check the IMEI on the device.`);
  }
  const simNumber = String(job.simNumber || input?.simNumber || '').trim();
  const now = new Date();
  const removalId = new mongoose.Types.ObjectId();

  /* The claim is the unique index on the removal's job: only one request can create it,
     a double tap or a retry hits the duplicate and is refused before any stock moves. */
  let removal;
  try {
    removal = await DeviceRemoval.create({
      _id: removalId,
      job: job._id,
      registration: job.vehicle?.registration,
      vehicleLabel: job.vehicle?.label,
      customer: job.customer,
      customerName: job.customerName,
      phone: job.phone,
      imei,
      simNumber,
      technician: technician._id,
      technicianName: technician.name,
      removedAt: now,
      note: String(input?.note ?? '').trim().slice(0, 500),
    });
  } catch (error) {
    if (error?.code === 11000) throw makeError(errorCodes.CONFLICT, 'The device on this vehicle was already removed.', 409);
    throw error;
  }

  try {
    await Job.updateOne({ _id: job._id }, { $set: { 'deviceRemoval.removal': removalId, 'deviceRemoval.imei': imei, 'deviceRemoval.at': now, 'deviceRemoval.byName': nameOf(user) } });

    /* Stock +1 for the remover. The SIM pairing and the configured flag are kept as they were. */
    const device = await Device.findOne({ imei });
    if (device) {
      device.technician = technician._id;
      device.status = 'assigned';
      device.job = undefined;
      device.installedAt = undefined;
      if (simNumber && !device.simNumber) device.simNumber = simNumber;
      await device.save();
    } else {
      await Device.create({ imei, technician: technician._id, status: 'assigned', simNumber, assignedAt: now });
    }
    if (simNumber) {
      const sim = await Sim.findOne({ number: simNumber });
      if (sim) {
        sim.technician = technician._id;
        sim.status = 'assigned';
        sim.job = undefined;
        sim.installedAt = undefined;
        sim.deviceImei = imei;
        await sim.save();
      } else {
        await Sim.create({ number: simNumber, technician: technician._id, status: 'assigned', deviceImei: imei, assignedAt: now });
      }
    }
  } catch (error) {
    /* Nothing was moved yet or the move failed half way: release the claim so it can be retried. */
    await DeviceRemoval.deleteOne({ _id: removalId });
    await Job.updateOne({ _id: job._id, 'deviceRemoval.removal': removalId }, { $unset: { deviceRemoval: 1 } });
    throw error;
  }

  await recordActivity({
    actor: user.id,
    type: 'job.status_changed',
    label: `Device removed · ${job.vehicle?.registration ?? ''}`,
    description: `${technician.name} removed ${imei} from ${job.vehicle?.registration ?? 'a vehicle'}; it is back in their stock.`,
    recordId: job.customer,
  });
  return removal.toApiJson();
}

export async function listRemovals(user) {
  const technician = await currentTechnician(user);
  const rows = await DeviceRemoval.find({ technician: technician._id }).sort({ removedAt: -1 }).limit(200);
  return rows.map((row) => row.toApiJson());
}

/** Installations this technician submitted, newest first; the install-side history. */
export async function listInstallations(user) {
  const technician = await currentTechnician(user);
  const jobs = await Job.find({
    technician: technician._id,
    requestType: 'new_installation',
    deviceImei: { $exists: true, $ne: '' },
    'testing.submittedAt': { $exists: true },
  }).sort({ 'testing.submittedAt': -1 }).limit(200);
  return jobs.map((job) => ({
    ...vehicleRow(job),
    submittedAt: job.testing.submittedAt?.toISOString() ?? null,
    approval: job.status === 'completed' ? 'approved' : (job.testing?.review?.status ?? 'pending'),
    removed: Boolean(job.deviceRemoval?.removal),
    removedAt: job.deviceRemoval?.at?.toISOString?.() ?? null,
  }));
}
