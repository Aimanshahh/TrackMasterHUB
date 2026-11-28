import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { getTechnicianStockGroups, refreshTechnicianStock } from '../tracking/tracking.service.js';
import Device from '../../models/Device.js';
import Technician from '../../models/Technician.js';
import { matchTechnician } from '../../utils/technicianMatch.js';
import { bindPortalSim, simKey } from './simBinding.js';

async function load() {
  const before = getTechnicianStockGroups();
  if (!before.configured) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The technician stock portal is not set up. Add PORTAL_1_TECHNICIANSTOCK_URL and PORTAL_1_TECHNICIANSTOCK_HASH to the server settings.', 503);
  }
  const snapshot = await refreshTechnicianStock();
  if (snapshot.error && !snapshot.syncedAt) throw makeError(errorCodes.VALIDATION_ERROR, snapshot.error, 502);
  return snapshot;
}

/** Exactly what is read from each technician's portal account, and what the Hub keeps itself. */
export const FETCHED_FIELDS = {
  fromPortal: [
    'Account (technician) name and login email: the account a device sits under',
    'Device IMEI',
    'Device ID on the portal',
    'Device name on the portal (usually the vehicle plate)',
    'SIM number, only when the portal has one',
    'Active or inactive on the portal',
    'Last report time, ignition, battery and GPS position (read for installation tests, not stored)',
  ],
  keptInHub: [
    'Technician record: name, phone, station, rates and login',
    'Device model, status, which technician holds it, which job it is fitted to',
    'The device and SIM pair, and whether Operations has marked it configured',
    'Installation and removal history, vehicle and customer details',
  ],
};

const rowOf = (device) => ({
  imei: device.imei,
  sim: device.simNumber || '',
  deviceId: device.trackerId ?? null,
  name: device.name || '',
  active: device.active,
  lastSeenAt: device.lastSeenAt ?? null,
});

/** Compares the portal with the Hub technician by technician, without changing anything. */
export async function portalReport() {
  const snapshot = await load();
  const technicians = await Technician.find({ active: true }).sort({ name: 1 });
  const hub = await Device.find({}).select('imei technician job status simNumber configured').lean();
  const hubByImei = new Map(hub.map((device) => [device.imei, device]));

  const everyPortalImei = new Map();
  for (const group of snapshot.groups) for (const device of group.devices) if (device.imei) everyPortalImei.set(device.imei, group.title || '(no account)');

  const technicianRows = [];
  const unmatched = [];
  const listedFor = new Set();

  for (const group of snapshot.groups) {
    if (!group.title) continue;
    const match = matchTechnician(group.title, technicians);
    const technician = match.technician;
    const devices = group.devices.filter((device) => device.imei);

    if (!technician) {
      unmatched.push({ portalName: group.title, login: group.login, devices: devices.length });
      continue;
    }
    listedFor.add(technician._id.toString());

    const issues = { missingInHub: [], heldByOther: [], simToBind: [], simMismatch: [] };
    for (const device of devices) {
      const mine = hubByImei.get(device.imei);
      if (!mine) { issues.missingInHub.push(rowOf(device)); continue; }
      if (!mine.job && mine.technician?.toString() !== technician._id.toString()) issues.heldByOther.push({ ...rowOf(device), hubHolder: mine.technician?.toString() ?? null });
      if (device.simNumber) {
        if (!mine.simNumber) issues.simToBind.push(rowOf(device));
        else if (simKey(mine.simNumber) !== simKey(device.simNumber)) issues.simMismatch.push({ ...rowOf(device), hubSim: mine.simNumber });
      }
    }

    const portalImeis = new Set(devices.map((device) => device.imei));
    const notOnPortal = hub
      .filter((device) => device.technician?.toString() === technician._id.toString() && !device.job && device.status !== 'installed' && !portalImeis.has(device.imei))
      .map((device) => ({ imei: device.imei, sim: device.simNumber || '', elsewhere: everyPortalImei.get(device.imei) ?? null }));

    technicianRows.push({
      technician: { id: technician._id.toString(), name: technician.name },
      portalName: group.title,
      login: group.login,
      match: match.how,
      portalDevices: devices.map(rowOf),
      hubDevices: hub.filter((device) => device.technician?.toString() === technician._id.toString() && !device.job && device.status !== 'installed').length,
      issues: { ...issues, notOnPortal },
      ok: Object.values(issues).every((list) => list.length === 0) && notOnPortal.length === 0,
    });
  }

  const noAccount = snapshot.groups.filter((group) => !group.title).reduce((sum, group) => sum + group.devices.length, 0);
  const withoutPortal = technicians
    .filter((technician) => !listedFor.has(technician._id.toString()))
    .map((technician) => ({ id: technician._id.toString(), name: technician.name }));

  return {
    generatedAt: new Date().toISOString(),
    source: { syncedAt: snapshot.syncedAt, error: snapshot.error, shape: snapshot.shape ?? null },
    technicians: technicianRows,
    unmatched,
    withoutPortal,
    noAccountDevices: noAccount,
    fields: FETCHED_FIELDS,
    totals: {
      portalDevices: snapshot.groups.reduce((sum, group) => sum + group.devices.length, 0),
      technicians: technicianRows.length,
      withIssues: technicianRows.filter((row) => !row.ok).length,
    },
  };
}

/**
 * Operations pressed "Bind SIM" on one device in the portal check. The SIM comes
 * from the portal's own record for that IMEI; an existing SIM is never overwritten
 * and the device is not marked configured.
 */
export async function bindSimFromPortal(imei) {
  const snapshot = await load();
  let portalSim = '';
  let login = '';
  for (const group of snapshot.groups) {
    const found = group.devices.find((device) => device.imei === imei);
    if (found) { portalSim = found.simNumber; login = group.title; break; }
  }
  if (!portalSim) throw makeError(errorCodes.VALIDATION_ERROR, 'The portal has no SIM number for that device.');
  const device = await Device.findOne({ imei });
  if (!device) throw makeError(errorCodes.NOT_FOUND, 'That device is not in the Hub.', 404);
  const technician = device.technician ? await Technician.findById(device.technician) : null;
  const result = await bindPortalSim(device, technician, portalSim);
  if (result.outcome === 'mismatch' || result.outcome === 'conflict') throw makeError(errorCodes.CONFLICT, result.detail, 409);
  return { imei, outcome: result.outcome, simNumber: device.simNumber || '', portalAccount: login };
}
