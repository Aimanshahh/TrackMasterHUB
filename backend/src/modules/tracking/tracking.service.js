import { env } from '../../config/env.js';
import Job from '../../models/Job.js';

/**
 * Read-only link to the GPSWOX tracking server.
 *
 * The backend reads the device list with a server-side API hash on a schedule
 * and keeps the latest answer in memory. Screens read that cache, so
 * a slow or unreachable tracking server never freezes the Hub, and a status is
 * only ever shown when the server really reported it.
 */

class TrackingError extends Error {}

// GPSWOX connection states. Anything else is reported as "unknown".
const CONNECTED_STATES = new Set(['online', 'ack', 'engine']);
const OFFLINE_STATES = new Set(['offline']);

const state = {
  devices: new Map(),
  portalDevices: new Map(),
  portalSync: new Map(),
  syncedAt: null,
  lastAttemptAt: null,
  lastError: null,
  syncing: null,
  timer: null,
};

export function isTrackingConfigured() {
  return env.trackingPortals.length > 0;
}

/** "AYM-118", " AYM 118 " and "aym118" all become "AYM118". */
export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeDeviceId(value) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

/** GPSWOX times look like "2026-11-02 11:16:02" with no zone attached. */
export function parseTrackerTime(value, offset = env.trackingTimeOffset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match || Number(match[1]) < 2000) return null; // "0000-00-00 …" means it never reported
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAmcExpiry(value) {
  const raw = String(value ?? '').trim();
  if (!raw || /^0{4}-0{2}-0{2}/.test(raw)) return null;

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00Z`)
    : new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
}

async function request(portal, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.trackingTimeoutMs);

  try {
    const response = await fetch(`${portal.url}${path}`, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) throw new TrackingError(`${portal.source}: the tracking API hash was refused by the tracking server.`);
    if (!response.ok) throw new TrackingError(`${portal.source}: the tracking server answered HTTP ${response.status}.`);

    const body = await response.text();
    try {
      return JSON.parse(body.replace(/^\uFEFF/, '').trim());
    } catch {
      const preview = body.trim().slice(0, 80).replace(/\s+/g, ' ');
      throw new TrackingError(`${portal.source}: the tracking server sent a reply that is not JSON${preview ? ` (${preview})` : ''}.`);
    }
  } catch (error) {
    if (error instanceof TrackingError) throw error;
    if (error.name === 'AbortError')     throw new TrackingError(`${portal.source}: the tracking server did not answer in time.`);
    throw new TrackingError('Could not reach the tracking server.');
  } finally {
    clearTimeout(timer);
  }
}

/** The device list is an array of groups, each holding its vehicles in `items`. */
export function flattenDevices(payload) {
  if (!Array.isArray(payload)) {
    throw new TrackingError('The tracking server sent a device list in an unexpected shape.');
  }

  const devices = [];
  for (const group of payload) {
    if (Array.isArray(group?.items)) devices.push(...group.items);
    else if (group && group.id !== undefined && group.name !== undefined) devices.push(group);
  }
  return devices;
}

export function toDevice(item) {
  const lastSeen = parseTrackerTime(item.time);
  const imei = normalizeDeviceId(item.imei ?? item.device_data?.imei);
  const uniqueId = normalizeDeviceId(item.uniqueId ?? item.device_data?.traccar?.uniqueId);
  const amcExpiryDate = parseAmcExpiry(
    item.expiration_date
      ?? item.sim_expiration_date
      ?? item.device_data?.expiration_date
      ?? item.device_data?.sim_expiration_date,
  );
  return {
    trackerId: item.id ?? null,
    name: String(item.name ?? '').trim(),
    plate: normalizePlate(item.name),
    imei,
    uniqueId,
    portalSource: item.portalSource ?? 'Unassigned',
    amcExpiryDate,
    gpsState: String(item.online ?? '').trim().toLowerCase(),
    lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
  };
}

async function fetchPortalDevices(portal) {
  const payload = await request(
    portal,
    `/get_devices?user_api_hash=${encodeURIComponent(portal.hash)}&lang=en`,
  );
  return flattenDevices(payload)
    .map((item) => toDevice({ ...item, portalSource: portal.source }))
    .filter((device) => {
      if (device.imei || device.uniqueId) return true;
      console.warn(`[tracking] skipped a ${portal.source} device without an IMEI or uniqueId.`);
      return false;
    });
}

function mergePortalDevices() {
  const next = new Map();
  const seenByIdentifier = new Map();

  for (const portal of env.trackingPortals) {
    const devices = state.portalDevices.get(portal.id) ?? [];
    for (const device of devices) {
      const identifiers = [device.imei && `imei:${device.imei}`, device.uniqueId && `unique:${device.uniqueId}`].filter(Boolean);
      for (const identifier of identifiers) {
        const existing = seenByIdentifier.get(identifier);
        if (existing && existing.portal.priority !== portal.priority) {
          const winner = existing.portal.priority > portal.priority ? existing : { device, portal };
          const loser = winner.device === device ? existing : { device, portal };
          console.warn(`[tracking] IMEI conflict for ${identifier}; keeping ${winner.portal.source} and ignoring ${loser.portal.source}.`);
          seenByIdentifier.set(identifier, winner);
        } else if (!existing) {
          seenByIdentifier.set(identifier, { device, portal });
        }
      }
    }
  }

  for (const [identifier, match] of seenByIdentifier) next.set(identifier, match.device);
  return next;
}

async function persistPortalData(devices) {
  const localJobs = await Job.find({ requestType: 'new_installation', status: 'completed' })
    .select('deviceImei')
    .lean();
  const missingImei = localJobs.filter((job) => !normalizeDeviceId(job.deviceImei)).length;
  if (missingImei) console.warn(`[tracking] skipped ${missingImei} local vehicles without an IMEI.`);

  const operations = devices
    .filter((device) => device.imei || device.uniqueId)
    .map((device) => ({
      updateMany: {
        filter: {
          $or: [
            ...(device.imei ? [{ deviceImei: device.imei }] : []),
            ...(device.uniqueId ? [{ deviceImei: device.uniqueId }] : []),
          ],
        },
        update: {
          $set: {
            portalSource: device.portalSource,
            amcExpiryDate: device.amcExpiryDate ? new Date(device.amcExpiryDate) : null,
          },
        },
      },
    }));

  if (operations.length) await Job.bulkWrite(operations, { ordered: false });
}

async function runSync() {
  try {
    const errors = [];
    let successfulPortals = 0;
    for (const portal of env.trackingPortals) {
      try {
        const devices = await fetchPortalDevices(portal);
        state.portalDevices.set(portal.id, devices);
        state.portalSync.set(portal.id, { syncedAt: new Date(), error: null });
        successfulPortals += 1;
      } catch (error) {
        const message = error instanceof TrackingError ? error.message : `${portal.source}: sync failed unexpectedly.`;
        errors.push(message);
        state.portalSync.set(portal.id, { syncedAt: state.portalSync.get(portal.id)?.syncedAt ?? null, error: message });
      }
    }

    if (!successfulPortals && errors.length && !state.syncedAt) throw new TrackingError(errors.join(' '));

    state.devices = mergePortalDevices();
    if (successfulPortals) state.syncedAt = new Date();
    state.lastError = errors.length ? `Some tracking portals failed: ${errors.join(' ')}` : null;
    const devices = [...new Set(state.devices.values())];
    try {
      await persistPortalData(devices);
    } catch (error) {
      state.lastError = `${state.lastError ? `${state.lastError} ` : ''}Portal metadata could not be saved: ${error.message}`;
      console.warn(`[tracking] metadata save failed: ${error.message}`);
    }
  } catch (error) {
    state.lastError = error instanceof TrackingError ? error.message : 'The tracking sync failed unexpectedly.';
    console.warn(`[tracking] sync failed: ${state.lastError}`);
  } finally {
    state.lastAttemptAt = new Date();
  }
}

export function getSyncStatus() {
  const configured = isTrackingConfigured();
  const stale = Boolean(
    state.syncedAt && Date.now() - state.syncedAt.getTime() > env.trackingSyncSeconds * 3 * 1000,
  );

  return {
    configured,
    syncedAt: state.syncedAt?.toISOString() ?? null,
    lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
    error: state.lastError,
    portals: env.trackingPortals.map((portal) => ({
      source: portal.source,
      syncedAt: state.portalSync.get(portal.id)?.syncedAt?.toISOString() ?? null,
      error: state.portalSync.get(portal.id)?.error ?? null,
    })),
    stale,
    deviceCount: new Set(state.devices.values()).size,
    syncSeconds: env.trackingSyncSeconds,
    inactiveAfterHours: env.trackingInactiveHours,
    inactiveAfterDays: INACTIVE_AFTER_DAYS,
  };
}

/**
 * Refresh the cache. Calls made while a sync is running share it, and a manual
 * refresh within 15 seconds of the last attempt reuses that attempt.
 */
export async function syncTracking({ manual = false } = {}) {
  if (!isTrackingConfigured()) return getSyncStatus();
  if (state.syncing) {
    await state.syncing;
    return getSyncStatus();
  }
  if (manual && state.lastAttemptAt && Date.now() - state.lastAttemptAt.getTime() < 15_000) {
    return getSyncStatus();
  }

  state.syncing = runSync().finally(() => { state.syncing = null; });
  await state.syncing;
  return getSyncStatus();
}

/** The first screen opened after a restart waits for the first sync. */
export async function ensureTrackingLoaded() {
  if (isTrackingConfigured() && !state.syncedAt && !state.lastAttemptAt) await syncTracking();
}

export function startTrackingSync() {
  if (!isTrackingConfigured()) {
    console.log('[tracking] not configured; vehicle status will show as unavailable.');
    return;
  }
  if (state.timer) return;

  syncTracking();
  state.timer = setInterval(() => { syncTracking(); }, env.trackingSyncSeconds * 1000);
  state.timer.unref?.();
  console.log(`[tracking] syncing every ${env.trackingSyncSeconds}s from ${env.trackingPortals.length} portal(s)`);
}

/** A vehicle must be silent this long, with its AMC expired, before it counts as Inactive. */
export const INACTIVE_AFTER_DAYS = 15;
const DAY_MS = 86_400_000;

/** True when the AMC expiry date is a real date that has already passed. */
export function isAmcExpired(amcExpiryDate, now = Date.now()) {
  if (!amcExpiryDate) return false;
  const expiry = new Date(amcExpiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() < now;
}

/**
 * The 15-day rule. A vehicle is Inactive only when it has not been seen for
 * more than 15 days AND its AMC has expired. Either one alone is not enough, so
 * a quiet vehicle with a valid AMC, or an expired AMC on a vehicle that still
 * reports, is not Inactive. A vehicle that never reported counts as silent.
 * This is about the vehicle only: a customer's Active/Inactive status comes
 * from the security briefing and is never derived from this.
 */
export function isVehicleInactive({ lastSeenAt, amcExpiryDate }, now = Date.now()) {
  const silentLongEnough = !lastSeenAt || now - new Date(lastSeenAt).getTime() > INACTIVE_AFTER_DAYS * DAY_MS;
  return silentLongEnough && isAmcExpired(amcExpiryDate, now);
}

/**
 * Active or Inactive from the tracking server's report plus the AMC. Unknown:
 * the tracking server reported a state this code does not know, or no sync has
 * succeeded yet. A vehicle the tracker does not list at all is "not_tracked",
 * never guessed as active or inactive. `options.amcExpiryDate` is the AMC date
 * saved in our own database; it wins, and the portal's date is only used when
 * ours is empty.
 */
export function statusFor(plate, imeiOrNow, now = Date.now(), options = {}) {
  const imei = typeof imeiOrNow === 'number' ? '' : imeiOrNow;
  const currentTime = typeof imeiOrNow === 'number' ? imeiOrNow : now;
  const tracking = {
    status: 'unknown',
    gpsState: '',
    lastSeenAt: null,
    trackerName: '',
    portalSource: '',
    amcExpiryDate: null,
  };

  if (!state.syncedAt) return tracking;

  const device = imei
    ? state.devices.get(`imei:${normalizeDeviceId(imei)}`)
      ?? state.devices.get(`unique:${normalizeDeviceId(imei)}`)
    : null;
  if (!device) return { ...tracking, status: 'not_tracked' };

  tracking.gpsState = device.gpsState;
  tracking.lastSeenAt = device.lastSeenAt;
  tracking.trackerName = device.name;
  tracking.portalSource = device.portalSource;
  tracking.amcExpiryDate = device.amcExpiryDate;

  if (!OFFLINE_STATES.has(device.gpsState) && !CONNECTED_STATES.has(device.gpsState)) return tracking;

  const amcExpiryDate = options.amcExpiryDate ?? device.amcExpiryDate;
  return { ...tracking, status: isVehicleInactive({ lastSeenAt: device.lastSeenAt, amcExpiryDate }, currentTime) ? 'inactive' : 'active' };
}

/** Test hook: replace the cache without touching the network. */
export function __setTrackingCache(devices, syncedAt = new Date()) {
  state.devices = new Map();
  for (const device of devices) {
    const keys = [
      device.imei && `imei:${normalizeDeviceId(device.imei)}`,
      device.uniqueId && `unique:${normalizeDeviceId(device.uniqueId)}`,
    ].filter(Boolean);
    for (const key of keys) state.devices.set(key, device);
  }
  state.syncedAt = syncedAt;
}
