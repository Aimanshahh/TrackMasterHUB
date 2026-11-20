/**
 * Legacy sheets write a two-device vehicle as two rows: ABC-111(LOC) for the
 * locator and ABC-111(IMB) for the immobilizer. These helpers turn either back
 * into the one real registration, ABC-111.
 */

/** Only a suffix inside brackets counts, so a plate that merely ends in those letters is left alone. */
const BRACKETED = /[\s-]*[([]\s*(LOC|LOCATOR|IMB|IMMOBILIZER|IMMOBILISER|IMMOB)\s*[)\]]\s*$/i;

export function splitVrn(value) {
  const text = String(value ?? '').trim();
  const match = text.match(BRACKETED);
  if (!match) return { vrn: text, role: null };
  const tag = match[1].toUpperCase();
  return { vrn: text.slice(0, match.index).trim(), role: tag.startsWith('LOC') ? 'locator' : 'immobilizer' };
}

/** "ABC-111(LOC)" -> "ABC-111" */
export const coreVrn = (value) => splitVrn(value).vrn;

export const deviceRoleLabels = { locator: 'Locator', immobilizer: 'Immobilizer', tracker: 'Tracker' };
