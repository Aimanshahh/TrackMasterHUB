import { env } from '../../config/env.js';
import { getDeviceTelemetry, refreshTechnicianStock, syncTracking } from '../tracking/tracking.service.js';

/** Re-reads the tracking portals; a failed refresh falls back to the cached reading. */
export async function refreshPortals() {
  await Promise.allSettled([refreshTechnicianStock(), syncTracking({ manual: true })]);
}

/** A reading only counts when the tracker itself reported recently. */
export function isFresh(telemetry, now = Date.now()) {
  if (!telemetry?.found) return false;
  if (!telemetry.lastSeenAt) return true;
  const seen = new Date(telemetry.lastSeenAt).getTime();
  if (Number.isNaN(seen)) return true;
  return now - seen <= env.portalReadingFreshMinutes * 60 * 1000;
}

/**
 * Applies one portal reading to the job's tests. Nothing is typed in by hand:
 * - location: the portal reports a position (the technician adds where it was fitted);
 * - ignition: both ON and OFF have been seen;
 * - battery:  both "disconnected" and "reconnected" have been seen.
 */
export function applyTelemetry(job, telemetry, now = new Date()) {
  const t = job.testing;
  const fresh = isFresh(telemetry, now.getTime());
  const check = {
    at: now,
    found: Boolean(telemetry?.found),
    stale: Boolean(telemetry?.found) && !fresh,
    lastSeenAt: telemetry?.lastSeenAt ? new Date(telemetry.lastSeenAt) : undefined,
    message: '',
  };

  if (!telemetry?.found) {
    check.message = telemetry?.error || 'The portal does not list this IMEI yet. Ask Operations to create the device user.';
  } else if (!fresh) {
    check.message = `The tracker has not reported in the last ${env.portalReadingFreshMinutes} minutes. Wait for it to report, then check again.`;
  } else {
    const label = (key) => (t[key].source = 'portal');

    if (telemetry.latitude !== null && telemetry.longitude !== null) {
      t.location.latitude = telemetry.latitude;
      t.location.longitude = telemetry.longitude;
      t.location.gpsReceived = true;
      label('location');
    }
    if (telemetry.ignitionOn !== null) {
      t.ignition.ignitionOn = telemetry.ignitionOn;
      t.ignition.objectStatus = telemetry.objectStatus ?? '';
      if (telemetry.ignitionOn) t.ignition.seenOn = true; else t.ignition.seenOff = true;
      label('ignition');
    }
    if (telemetry.batteryConnected !== null) {
      t.battery.connected = telemetry.batteryConnected;
      if (telemetry.batteryConnected) t.battery.seenConnected = true; else t.battery.seenDisconnected = true;
      label('battery');
    }
    if (telemetry.ignitionOn === null && telemetry.batteryConnected === null) {
      check.message = 'The portal reports a position only for this device. Ignition and battery are not exposed, so record them manually.';
    }
  }

  t.portalCheck = check;
  settleTests(job, now);
  return check;
}

/** Marks each portal-driven test verified once its evidence is complete. */
export function settleTests(job, now = new Date()) {
  const t = job.testing;
  const mark = (test, done) => {
    if (done && test.status !== 'verified') {
      test.status = 'verified';
      test.verifiedAt = now;
      test.verifiedByName = 'Tracking portal';
    } else if (!done && test.status === 'verified' && test.source === 'portal') {
      test.status = 'pending';
    }
  };
  mark(t.location, t.location.gpsReceived === true && Boolean(t.location.physicalLocation) && t.location.source === 'portal');
  mark(t.ignition, t.ignition.source === 'portal' && t.ignition.seenOn && t.ignition.seenOff);
  mark(t.battery, t.battery.source === 'portal' && t.battery.seenConnected && t.battery.seenDisconnected);
}

export { getDeviceTelemetry };
