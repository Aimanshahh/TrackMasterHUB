import Device from '../../models/Device.js';
import Sim from '../../models/Sim.js';

/** SIM numbers are typed many ways (0300…, +92300…, 92300…), so compare the last ten digits. */
export const simKey = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Binds the SIM the portal reports to a device, but only when it is safe:
 * - no SIM on the portal -> nothing to do (Operations enters it by hand);
 * - the device already has a SIM -> never overwritten; a different one is reported;
 * - the SIM is paired with another device or fitted to a job -> reported, not moved.
 * A bound pair is never marked configured; that stays Operations' check.
 * Returns { outcome, detail } where outcome is bound | same | none | mismatch | conflict.
 */
export async function bindPortalSim(device, technician, portalSim) {
  const key = simKey(portalSim);
  if (key.length < 7) return { outcome: 'none' };

  if (device.simNumber) {
    return simKey(device.simNumber) === key
      ? { outcome: 'same' }
      : { outcome: 'mismatch', detail: `Hub has SIM ${device.simNumber}, the portal has ${portalSim}. Left as it is.` };
  }

  let sim = await Sim.findOne({ number: new RegExp(`${escape(key)}$`) });
  if (sim) {
    if (sim.job) return { outcome: 'conflict', detail: `SIM ${sim.number} is fitted to a job.` };
    if (sim.deviceImei && sim.deviceImei !== device.imei) {
      return { outcome: 'conflict', detail: `SIM ${sim.number} is already paired with device ${sim.deviceImei}.` };
    }
    if (sim.technician && technician && sim.technician.toString() !== technician._id.toString()) {
      return { outcome: 'conflict', detail: `SIM ${sim.number} is held by a different technician.` };
    }
  } else {
    sim = new Sim({ number: String(portalSim).trim(), station: technician?.station || device.station || undefined, status: 'in_stock', notes: 'Added from the tracking portal.' });
  }

  sim.deviceImei = device.imei;
  if (technician) {
    sim.technician = technician._id;
    sim.status = 'assigned';
  }
  device.simNumber = sim.number;
  device.configured = false;
  await sim.save();
  await device.save();
  return { outcome: 'bound', detail: `SIM ${sim.number}` };
}

export { Device };
