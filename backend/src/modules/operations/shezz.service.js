import { env } from '../../config/env.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import Device from '../../models/Device.js';
import Technician from '../../models/Technician.js';
import { matchTechnician, normalizeName } from '../../utils/technicianMatch.js';

const FETCH_LIMIT = 2000;
const TIMEOUT_MS = 15000;

async function fetchHandovers() {
  if (!env.shezzApiUrl || !env.shezzApiKey) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The Shezz connection is not set up. Add SHEZZ_API_URL and SHEZZ_API_KEY to the server settings.', 503);
  }

  let response;
  try {
    response = await fetch(`${env.shezzApiUrl}/integrations/handovers?limit=${FETCH_LIMIT}`, {
      headers: { 'x-api-key': env.shezzApiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw makeError(errorCodes.VALIDATION_ERROR, `Shezz Traders could not be reached: ${error.cause?.code ?? error.message}`, 502);
  }

  if (response.status === 401) throw makeError(errorCodes.FORBIDDEN, 'Shezz Traders refused the key. Check SHEZZ_API_KEY.', 502);
  if (!response.ok) throw makeError(errorCodes.VALIDATION_ERROR, `Shezz Traders answered with an error (${response.status}).`, 502);

  const body = await response.json();
  return { rows: body.data ?? [], hasMore: Boolean(body.hasMore) };
}

/** Last handover per IMEI wins; rows arrive oldest first. */
function latestPerImei(rows) {
  const byImei = new Map();
  for (const row of rows) {
    if (row.imei && row.recipient?.name) byImei.set(String(row.imei).trim(), row);
  }
  return [...byImei.values()];
}

function groupByRecipient(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.recipient.id || normalizeName(row.recipient.name);
    if (!groups.has(key)) groups.set(key, { key, shezzName: row.recipient.name, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

const validImei = (imei) => /^\d{14,17}$/.test(imei);

/** What importing would do, without changing anything. */
export async function previewShezzSync() {
  const { rows, hasMore } = await fetchHandovers();
  const handovers = latestPerImei(rows);
  const technicians = await Technician.find({ active: true }).sort({ name: 1 });
  const existing = await Device.find({ imei: { $in: handovers.map((row) => String(row.imei).trim()) } }).select('imei technician job');
  const existingByImei = new Map(existing.map((device) => [device.imei, device]));

  const groups = groupByRecipient(handovers).map((group) => {
    const match = matchTechnician(group.shezzName, technicians);
    const technicianId = match.technician?._id.toString() ?? '';
    let fresh = 0;
    let move = 0;
    let same = 0;
    let fitted = 0;
    let invalid = 0;
    for (const row of group.rows) {
      const imei = String(row.imei).trim();
      const device = existingByImei.get(imei);
      if (!validImei(imei)) invalid += 1;
      else if (!device) fresh += 1;
      else if (device.job) fitted += 1;
      else if (technicianId && device.technician?.toString() === technicianId) same += 1;
      else move += 1;
    }
    return {
      key: group.key,
      shezzName: group.shezzName,
      deviceCount: group.rows.length,
      newDevices: fresh,
      toReassign: move,
      alreadyThere: same,
      fitted,
      invalid,
      match: match.technician ? { technicianId, name: match.technician.name, how: match.how } : null,
    };
  });

  return {
    groups: groups.sort((a, b) => a.shezzName.localeCompare(b.shezzName)),
    technicians: technicians.map((t) => ({ id: t._id.toString(), name: t.name, station: t.station ?? '' })),
    totals: { devices: handovers.length },
    truncated: hasMore,
  };
}

/**
 * Brings the devices in. mappings is { groupKey: technicianId } for the people
 * who chose a technician by hand; exact and remembered matches apply by themselves.
 * Suggested matches and unknown names are only imported when mapped.
 */
export async function applyShezzSync({ mappings = {} } = {}, actor) {
  const { rows } = await fetchHandovers();
  const technicians = await Technician.find({ active: true });
  const byId = new Map(technicians.map((t) => [t._id.toString(), t]));

  const summary = { created: 0, reassigned: 0, unchanged: 0, fitted: 0, invalid: 0, skippedNames: [] };

  for (const group of groupByRecipient(latestPerImei(rows))) {
    let technician = null;
    const chosen = mappings[group.key];
    if (chosen) {
      technician = byId.get(String(chosen)) ?? null;
      if (!technician) throw makeError(errorCodes.VALIDATION_ERROR, `Choose an active technician for ${group.shezzName}.`);
    } else {
      const match = matchTechnician(group.shezzName, technicians);
      if (match.how === 'exact' || match.how === 'alias') technician = match.technician;
    }

    if (!technician) {
      summary.skippedNames.push(group.shezzName);
      continue;
    }

    for (const row of group.rows) {
      const imei = String(row.imei).trim();
      if (!validImei(imei)) { summary.invalid += 1; continue; }

      const source = [row.invoiceNumber && `Shezz invoice ${row.invoiceNumber}`, row.boxCode && `box ${row.boxCode}`].filter(Boolean).join(', ');
      const device = await Device.findOne({ imei });

      if (!device) {
        await Device.create({
          imei,
          model: row.productName || undefined,
          station: technician.station || undefined,
          technician: technician._id,
          status: 'assigned',
          notes: source ? `Imported from Shezz Traders (${source}).` : 'Imported from Shezz Traders.',
          createdBy: actor?.id,
        });
        summary.created += 1;
      } else if (device.job) {
        summary.fitted += 1;
      } else if (device.technician?.toString() === technician._id.toString() && device.status === 'assigned') {
        summary.unchanged += 1;
      } else {
        device.technician = technician._id;
        device.status = 'assigned';
        await device.save();
        summary.reassigned += 1;
      }
    }

    // Remember a hand-picked spelling so the same name matches by itself next time.
    if (chosen) {
      const alias = normalizeName(group.shezzName);
      const known = [technician.name, ...(technician.aliases ?? [])].map(normalizeName);
      if (alias && !known.includes(alias)) {
        technician.aliases = [...(technician.aliases ?? []), group.shezzName];
        await technician.save();
      }
    }
  }

  return summary;
}
