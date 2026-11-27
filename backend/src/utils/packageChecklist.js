/**
 * What the salesperson must confirm with the customer before a package is sold.
 * Only the things that set a package apart are listed: geofence and alerts come
 * with every package, so they are not repeated here.
 */
export const PACKAGE_CHECKLISTS = {
  basic: [
    { key: 'engine_kill_call', label: 'Engine kill is on call only (the customer phones the helpline)' },
  ],
  standard: [
    { key: 'engine_kill_app', label: 'Engine kill from the app' },
    { key: 'one_way_voice', label: 'One-way communication (a microphone SIM number is assigned)' },
  ],
  premium: [
    { key: 'engine_kill_app', label: 'Engine kill from the app' },
    { key: 'alerts_sim_whatsapp', label: 'Alerts on SIM message and WhatsApp' },
    { key: 'advanced_locator', label: 'Advanced locator — a second device is fitted' },
    { key: 'voice_two_way', label: 'Voice communication (two-way)' },
  ],
  customize: [
    { key: 'agreed_features', label: 'The features the customer agreed to are written in Additional features' },
  ],
  personal: [
    { key: 'ownership_confirmed', label: 'Device ownership is confirmed with the customer' },
  ],
};

export const checklistFor = (packageKey) => PACKAGE_CHECKLISTS[packageKey] ?? [];

/** The labels still unticked for this package. */
export function missingChecklist(packageKey, confirmed) {
  const done = new Set(Array.isArray(confirmed) ? confirmed.map(String) : []);
  return checklistFor(packageKey).filter((item) => !done.has(item.key)).map((item) => item.label);
}

/** Confirmed items for this package, as {key,label}, ignoring keys that don't belong to it. */
export function confirmedItems(packageKey, confirmed) {
  const done = new Set(Array.isArray(confirmed) ? confirmed.map(String) : []);
  return checklistFor(packageKey).filter((item) => done.has(item.key));
}
