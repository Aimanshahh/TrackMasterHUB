import { env } from '../../config/env.js';

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
  syncedAt: null,
  lastAttemptAt: null,
  lastError: null,
  syncing: null,
  timer: null,
};

export function isTrackingConfigured() {
  return Boolean(env.trackingApiUrl && env.trackingApiHash);
}

/** "AYM-118", " AYM 118 " and "aym118" all become "AYM118". */
export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** GPSWOX times look like "2026-11-02 11:16:02" with no zone attached. */
export function parseTrackerTime(value, offset = env.trackingTimeOffset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match || Number(match[1]) < 2000) return null; // "0000-00-00 …" means it never reported
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.trackingTimeoutMs);

  try {
    const response = await fetch(`${env.trackingApiUrl}${path}`, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) throw new TrackingError('The tracking API hash was refused by the tracking server.');
    if (!response.ok) throw new TrackingError(`The tracking server answered HTTP ${response.status}.`);

    try {
      return await response.json();
    } catch {
      throw new TrackingError('The tracking server sent a reply that is not JSON.');
    }
  } catch (error) {
    if (error instanceof TrackingError) throw error;
    if (error.name === 'AbortError') throw new TrackingError('The tracking server did not answer in time.');
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
  return {
    trackerId: item.id ?? null,
    name: String(item.name ?? '').trim(),
    plate: normalizePlate(item.name),
    gpsState: String(item.online ?? '').trim().toLowerCase(),
    lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
  };
}

async function fetchDevices() {
  const payload = await request(`/api/get_devices?lang=en&user_api_hash=${encodeURIComponent(env.trackingApiHash)}`);
  return flattenDevices(payload).map(toDevice).filter((device) => device.plate);
}

async function runSync() {
  try {
    const devices = await fetchDevices();

    const next = new Map();
    for (const device of devices) {
      // Two tracker entries for one plate: keep the one that reported last.
      const existing = next.get(device.plate);
      if (!existing || (device.lastSeenAt ?? '') > (existing.lastSeenAt ?? '')) next.set(device.plate, device);
    }

    state.devices = next;
    state.syncedAt = new Date();
    state.lastError = null;
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
    stale,
    deviceCount: state.devices.size,
    syncSeconds: env.trackingSyncSeconds,
    inactiveAfterHours: env.trackingInactiveHours,
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
  console.log(`[tracking] syncing every ${env.trackingSyncSeconds}s from ${env.trackingApiUrl}`);
}

/**
 * Active: connected and reported recently. Inactive: offline, or silent for
 * longer than the limit. Unknown: the tracking server reported a state this
 * code does not know, or no sync has succeeded yet. A vehicle the tracker does
 * not list at all is "not_tracked", never guessed as active or inactive.
 */
export function statusFor(plate, now = Date.now()) {
  const tracking = { status: 'unknown', gpsState: '', lastSeenAt: null, trackerName: '' };

  if (!state.syncedAt) return tracking;

  const device = state.devices.get(normalizePlate(plate));
  if (!device) return { ...tracking, status: 'not_tracked' };

  tracking.gpsState = device.gpsState;
  tracking.lastSeenAt = device.lastSeenAt;
  tracking.trackerName = device.name;

  if (OFFLINE_STATES.has(device.gpsState)) return { ...tracking, status: 'inactive' };
  if (!CONNECTED_STATES.has(device.gpsState)) return tracking;
  if (!device.lastSeenAt) return { ...tracking, status: 'inactive' };

  const ageMs = now - new Date(device.lastSeenAt).getTime();
  return { ...tracking, status: ageMs > env.trackingInactiveHours * 3_600_000 ? 'inactive' : 'active' };
}

/** Test hook: replace the cache without touching the network. */
export function __setTrackingCache(devices, syncedAt = new Date()) {
  state.devices = new Map(devices.map((device) => [device.plate, device]));
  state.syncedAt = syncedAt;
}
