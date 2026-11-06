/**
 * Installation record rules for the screen. They mirror backend/src/utils/installation.js
 * so Operations sees what is still needed while typing; the server makes the final decision.
 */

export const CHECKLIST_ITEMS = [
  { key: 'deviceInstalled', label: 'GPS device physically installed', core: true },
  { key: 'devicePoweredOn', label: 'Device powered on', core: true },
  { key: 'gpsSignal', label: 'GPS signal verified', core: true },
  { key: 'liveLocation', label: 'Live location verified', core: true },
  { key: 'simConnectivity', label: 'SIM / network connectivity verified', core: true },
  { key: 'trackingTested', label: 'Vehicle tracking tested', core: true },
  { key: 'immobilizationTested', label: 'Engine immobilization tested', core: false, hint: 'Only where the vehicle supports it.' },
];

export const ENGINE_KILL_OPTIONS = [
  { value: 'not_set', label: 'Not recorded yet' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_implemented', label: 'Not implemented' },
];

export const engineKillLabel = (status) => ENGINE_KILL_OPTIONS.find((option) => option.value === status)?.label ?? 'Not recorded yet';

export const engineKillTone = (status) => (status === 'implemented' ? 'paid' : status === 'not_implemented' ? 'partial' : 'muted');

export const PLACEMENT_SUGGESTIONS = ['Dashboard', 'Under dashboard', 'Behind glove box', 'Near fuse box', 'Under driver seat', 'Behind instrument cluster', 'Engine bay'];

const filled = (value) => String(value ?? '').trim().length > 0;

/** What is still missing, from the values currently typed into the form. */
export function completionMissing(form, job) {
  const missing = [];
  if (!filled(form.technicianId)) missing.push('Assign a technician');
  if (!filled(job.vehicle?.registration)) missing.push('Vehicle registration number');
  if (!filled(form.deviceImei)) missing.push('Device IMEI');
  if (!filled(form.simNumber)) missing.push('SIM number');
  if (!filled(form.placement)) missing.push('Where the device is fitted in the vehicle');
  if (!filled(form.address)) missing.push('Installation address / location');
  for (const item of CHECKLIST_ITEMS.filter((entry) => entry.core)) {
    if (!form.checklist?.[item.key]) missing.push(`Tick: ${item.label}`);
  }
  if (form.engineKillStatus === 'not_set') missing.push('Record the engine kill status (Implemented or Not implemented)');
  else if (form.engineKillStatus === 'not_implemented' && !filled(form.engineKillReason)) missing.push('Reason engine kill is not implemented');
  else if (form.engineKillStatus === 'implemented' && !form.checklist?.immobilizationTested) missing.push('Tick: Engine immobilization tested');
  return missing;
}
