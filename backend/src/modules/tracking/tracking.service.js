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
  stockGroups: [],
  stockDevices: new Map(),
  stockSync: { syncedAt: null, error: null },
  syncedAt: null,
  lastAttemptAt: null,
  lastError: null,
  syncing: null,
  timer: null,
};

export function isTrackingConfigured() {
  return env.trackingPortals.length > 0 || Boolean(env.technicianStockPortal);
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
  const readNumber = (...values) => {
    for (const value of values) {
      const number = Number(value);
      if (value !== null && value !== '' && Number.isFinite(number)) return number;
    }
    return null;
  };
  const readBoolean = (...values) => {
    for (const value of values) {
      if (value === true || value === 1 || value === '1' || value === 'true') return true;
      if (value === false || value === 0 || value === '0' || value === 'false') return false;
    }
    return null;
  };
  const deviceData = item.device_data ?? {};

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
    /* Telemetry used by the installation tests. Every value is kept as the
       portal reported it, or null when the portal does not expose it. */
    objectStatus: String(item.object_status ?? item.status ?? deviceData.object_status ?? '').trim(),
    ignitionOn: readBoolean(item.ignition, deviceData.ignition, item.acc, deviceData.acc),
    batteryTemperatureC: readNumber(
      item.battery_temperature,
      item.battery_temp,
      deviceData.battery_temperature,
      deviceData.battery_temp,
    ),
    batteryConnected: readBoolean(
      item.battery_connected,
      deviceData.battery_connected,
      item.power_connected,
      deviceData.power_connected,
    ),
    latitude: readNumber(item.lat, deviceData.lat, item.latitude),
    longitude: readNumber(item.lng, deviceData.lng, item.longitude),
    address: String(item.address ?? deviceData.address ?? '').trim(),
  };
}

/** Groups with their title, so the technician-stock portal can tell whose stock a device is. */
export function flattenGroups(payload) {
  if (!Array.isArray(payload)) throw new TrackingError('The tracking server sent a device list in an unexpected shape.');
  return payload
    .filter((group) => Array.isArray(group?.items))
    .map((group) => ({ id: String(group.id ?? group.title ?? ''), title: String(group.title ?? group.name ?? '').trim(), items: group.items }));
}


/** "ASGHAR-SUKKER@TM.PK" -> "ASGHAR SUKKER": the portal user's login read as a technician name. */
export function nameFromLogin(value) {
  return String(value ?? '').split('@')[0].replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const OWNER_PATHS = [
  ['user_email'], ['owner_email'], ['client_email'], ['email'],
  ['user', 'email'], ['owner', 'email'], ['client', 'email'], ['users', 0, 'email'],
  ['device_data', 'user_email'], ['device_data', 'user', 'email'], ['device_data', 'users', 0, 'email'],
  ['user_name'], ['owner_name'], ['client_name'], ['user', 'name'], ['owner', 'name'],
];

const dig = (item, path) => path.reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), item);

/** Whose account a device sits under, when the portal says so; '' when it does not. */
export function ownerOf(item) {
  for (const path of OWNER_PATHS) {
    const value = dig(item, path);
    if (typeof value === 'string' && value.trim()) return nameFromLogin(value);
  }
  return '';
}

const isUngrouped = (title) => !title || /^ungrouped$/i.test(String(title).trim());

/** Field names only, so an operator can see what the portal sends without exposing values. */
function shapeOf(payload, groups, ownersFound, total) {
  const first = (Array.isArray(payload) ? payload : []).flatMap((group) => (Array.isArray(group?.items) ? group.items : [group])).find((item) => item && typeof item === 'object');
  return {
    totalDevices: total,
    ownersFound,
    groups: groups.map((group) => ({ title: group.title || '(none)', devices: group.devices.length })),
    deviceFields: first ? Object.keys(first).sort() : [],
    deviceDataFields: first?.device_data && typeof first.device_data === 'object' ? Object.keys(first.device_data).sort() : [],
  };
}

async function syncTechnicianStock() {
  const portal = env.technicianStockPortal;
  if (!portal) return;
  try {
    const payload = await request(portal, `/get_devices?user_api_hash=${encodeURIComponent(portal.hash)}&lang=en`);
    /* A technician's devices are found by (1) the account the device sits under when the portal
       says so, (2) the named group it is in, (3) otherwise they stay unassigned. */
    const buckets = new Map();
    let total = 0;
    let ownersFound = 0;
    const put = (title, device) => {
      total += 1;
      const key = title.toLowerCase();
      if (!buckets.has(key)) buckets.set(key, { id: key || 'ungrouped', title, items: [], devices: [] });
      buckets.get(key).devices.push(device);
    };
    for (const group of flattenGroups(payload)) {
      for (const item of group.items) {
        const device = toDevice({ ...item, portalSource: portal.source });
        if (!device.imei && !device.uniqueId) continue;
        const owner = ownerOf(item);
        if (owner) ownersFound += 1;
        put(owner || (isUngrouped(group.title) ? '' : group.title), device);
      }
    }
    for (const item of flattenDevices(payload.filter((group) => !Array.isArray(group?.items)))) {
      const device = toDevice({ ...item, portalSource: portal.source });
      const owner = ownerOf(item);
      if (owner) ownersFound += 1;
      put(owner, device);
    }
    const groups = [...buckets.values()];
    state.stockShape = shapeOf(payload, groups, ownersFound, total);
    state.stockGroups = groups;
    state.stockDevices = new Map();
    for (const group of groups) {
      for (const device of group.devices) {
        if (device.imei) state.stockDevices.set(`imei:${device.imei}`, device);
        if (device.uniqueId) state.stockDevices.set(`unique:${device.uniqueId}`, device);
      }
    }
    state.stockSync = { syncedAt: new Date(), error: null };
  } catch (error) {
    const message = error instanceof TrackingError ? error.message : 'Technician stock: sync failed unexpectedly.';
    state.stockSync = { syncedAt: state.stockSync.syncedAt, error: message };
  }
}

/** What the technician-stock account currently lists, grouped by technician, with how fresh it is. */
export function getTechnicianStockGroups() {
  return {
    configured: Boolean(env.technicianStockPortal),
    syncedAt: state.stockSync.syncedAt?.toISOString() ?? null,
    error: state.stockSync.error,
    shape: state.stockShape ?? null,
    groups: state.stockGroups.map((group) => ({ id: group.id, title: group.title, devices: group.devices })),
  };
}

export async function refreshTechnicianStock() {
  await syncTechnicianStock();
  return getTechnicianStockGroups();
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

    await syncTechnicianStock();

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

/**
 * The portal's current reading for one device, used by the installation tests.
 * Nothing is invented: a field the portal does not send stays null.
 */
export function getDeviceTelemetry(imei) {
  const key = normalizeDeviceId(imei);
  /* A device still in the technician-stock account is a real portal reading too: it is
     used only when no customer portal lists the IMEI, and its source says so. */
  const device = key
    ? state.devices.get(`imei:${key}`) ?? state.devices.get(`unique:${key}`) ?? state.stockDevices.get(`imei:${key}`) ?? state.stockDevices.get(`unique:${key}`)
    : null;

  if (!device) {
    return {
      found: false,
      configured: isTrackingConfigured(),
      syncedAt: state.syncedAt?.toISOString() ?? null,
      error: state.syncedAt ? 'The tracking portal does not list this IMEI.' : 'The tracking portal has not been read yet.',
    };
  }

  return {
    found: true,
    configured: isTrackingConfigured(),
    syncedAt: state.syncedAt?.toISOString() ?? null,
    gpsState: device.gpsState ?? '',
    lastSeenAt: device.lastSeenAt ?? null,
    objectStatus: device.objectStatus ?? '',
    ignitionOn: device.ignitionOn ?? null,
    batteryTemperatureC: device.batteryTemperatureC ?? null,
    batteryConnected: device.batteryConnected ?? null,
    latitude: device.latitude ?? null,
    longitude: device.longitude ?? null,
    address: device.address ?? '',
    portalSource: device.portalSource ?? '',
  };
}

/** Test hook: replace the technician-stock cache. */
export function __setTechnicianStockCache(devices) {
  state.stockDevices = new Map();
  for (const device of devices) {
    if (device.imei) state.stockDevices.set(`imei:${normalizeDeviceId(device.imei)}`, device);
  }
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
