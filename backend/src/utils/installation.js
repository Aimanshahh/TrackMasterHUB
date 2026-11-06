/**
 * The rules for an installation record, in one place and free of the database,
 * so the same list drives the server's checks, the screen's "still needed" list
 * and the tests.
 */

/** The checklist Operations ticks from what the technician reports. */
export const CHECKLIST_ITEMS = [
  { key: 'deviceInstalled', label: 'GPS device physically installed', core: true },
  { key: 'devicePoweredOn', label: 'Device powered on', core: true },
  { key: 'gpsSignal', label: 'GPS signal verified', core: true },
  { key: 'liveLocation', label: 'Live location verified', core: true },
  { key: 'simConnectivity', label: 'SIM / network connectivity verified', core: true },
  { key: 'trackingTested', label: 'Vehicle tracking tested', core: true },
  { key: 'immobilizationTested', label: 'Engine immobilization tested', core: false },
];

export const CHECKLIST_KEYS = CHECKLIST_ITEMS.map((item) => item.key);

export const ENGINE_KILL_STATUSES = ['not_set', 'implemented', 'not_implemented'];

export const engineKillLabels = {
  not_set: 'Not recorded',
  implemented: 'Implemented',
  not_implemented: 'Not implemented',
};

const filled = (value) => String(value ?? '').trim().length > 0;

/**
 * What is still missing before an installation may be marked complete.
 * Engine kill never blocks completion by being "Not implemented"; it only has
 * to be decided, and a decision of "Not implemented" must carry a reason.
 * Engine, chassis, battery temperature and device model are worth recording but
 * are not required.
 */
export function completionMissing(job) {
  const i = job.installation ?? {};
  const missing = [];

  if (!job.technician) missing.push({ field: 'technician', label: 'Assign a technician' });
  if (!filled(job.vehicle?.registration)) missing.push({ field: 'registration', label: 'Vehicle registration number' });
  if (!filled(job.deviceImei)) missing.push({ field: 'deviceImei', label: 'Device IMEI' });
  if (!filled(job.simNumber)) missing.push({ field: 'simNumber', label: 'SIM number' });
  if (!filled(i.placement)) missing.push({ field: 'placement', label: 'Where the device is fitted in the vehicle' });
  if (!filled(i.address)) missing.push({ field: 'address', label: 'Installation address / location' });

  for (const item of CHECKLIST_ITEMS.filter((entry) => entry.core)) {
    if (!i.checklist?.[item.key]) missing.push({ field: `checklist.${item.key}`, label: `Tick: ${item.label}` });
  }

  const kill = i.engineKill ?? {};
  const status = kill.status ?? 'not_set';
  if (status === 'not_set') {
    missing.push({ field: 'engineKill', label: 'Record the engine kill status (Implemented or Not implemented)' });
  } else if (status === 'not_implemented' && !filled(kill.reason)) {
    missing.push({ field: 'engineKill.reason', label: 'Reason engine kill is not implemented' });
  } else if (status === 'implemented' && !i.checklist?.immobilizationTested) {
    missing.push({ field: 'checklist.immobilizationTested', label: 'Tick: Engine immobilization tested' });
  }

  return missing;
}

export function completionStatus(job) {
  const missing = completionMissing(job);
  return { ready: missing.length === 0, missing };
}
