import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { getTechnicianStockGroups, refreshTechnicianStock } from '../tracking/tracking.service.js';
import { applyHandovers, previewHandovers } from './shezz.service.js';

/**
 * The tracking account that holds the technicians' stock, read as a second
 * source of "this device belongs to this technician". Groups are named after
 * the technicians and are matched the same way as names from Shezz Traders.
 */
function rowsFrom(snapshot) {
  const rows = [];
  for (const group of snapshot.groups) {
    if (!group.title) continue;
    for (const device of group.devices) {
      if (device.imei) rows.push({ imei: device.imei, recipient: { id: group.id, name: group.title }, productName: '' });
    }
  }
  return rows;
}

async function load() {
  const before = getTechnicianStockGroups();
  if (!before.configured) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The technician stock portal is not set up. Add PORTAL_1_TECHNICIANSTOCK_URL and PORTAL_1_TECHNICIANSTOCK_HASH to the server settings.', 503);
  }
  const snapshot = await refreshTechnicianStock();
  if (snapshot.error && !snapshot.syncedAt) throw makeError(errorCodes.VALIDATION_ERROR, snapshot.error, 502);
  return snapshot;
}

export async function previewStockPortal() {
  const snapshot = await load();
  const preview = await previewHandovers(rowsFrom(snapshot));
  return { ...preview, source: { syncedAt: snapshot.syncedAt, error: snapshot.error, shape: snapshot.shape ?? null } };
}

export async function applyStockPortal(input, actor) {
  const snapshot = await load();
  return applyHandovers(rowsFrom(snapshot), input, actor, 'the technician stock portal');
}
