import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import Device from '../../models/Device.js';
import Technician from '../../models/Technician.js';
import { getDeviceTelemetry } from '../tracking/tracking.service.js';
import { bindPortalSim } from './simBinding.js';

/**
 * Operations pressed "Bind SIM" on one device. The SIM is the one the portal
 * already holds against that IMEI (added there by the team that lists devices
 * under each technician). An existing SIM is never overwritten and the device
 * is not marked configured.
 */
export async function bindSimFromPortal(imei) {
  const reading = getDeviceTelemetry(imei);
  if (!reading.found) throw makeError(errorCodes.VALIDATION_ERROR, 'The portal does not list that device.');
  if (!reading.simNumber) throw makeError(errorCodes.VALIDATION_ERROR, 'The portal has no SIM number for that device. Pair one by hand from stock.');
  const device = await Device.findOne({ imei });
  if (!device) throw makeError(errorCodes.NOT_FOUND, 'That device is not in the Hub.', 404);
  const technician = device.technician ? await Technician.findById(device.technician) : null;
  const result = await bindPortalSim(device, technician, reading.simNumber);
  if (result.outcome === 'mismatch' || result.outcome === 'conflict') throw makeError(errorCodes.CONFLICT, result.detail, 409);
  return { imei, outcome: result.outcome, simNumber: device.simNumber || '' };
}
