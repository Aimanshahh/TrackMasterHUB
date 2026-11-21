/**
 * Matching a technician typed one way in another system to the technician
 * created here. "Zahoor Technician", "Technician Yusuf" and "ZAHOOR " all
 * reduce to a plain lower-case name before they are compared.
 */
const NOISE_WORDS = new Set(['technician', 'tech', 'mr', 'sir']);

export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !NOISE_WORDS.has(word))
    .join(' ');
}

/**
 * Returns { technician, how } where how is:
 *  'exact'     same name once the noise words are removed  -> safe to apply
 *  'alias'     a spelling that was confirmed before          -> safe to apply
 *  'suggested' one name contains the other ("Zahoor" / "Zahoor Ahmed"), and only
 *              one technician fits -> shown pre-selected, a person confirms
 *  null        nothing fits
 */
export function matchTechnician(name, technicians) {
  const wanted = normalizeName(name);
  if (!wanted) return { technician: null, how: null };

  const exact = technicians.filter((t) => normalizeName(t.name) === wanted);
  if (exact.length === 1) return { technician: exact[0], how: 'exact' };

  const aliased = technicians.filter((t) => (t.aliases ?? []).some((alias) => normalizeName(alias) === wanted));
  if (aliased.length === 1) return { technician: aliased[0], how: 'alias' };

  const wantedWords = wanted.split(' ');
  const close = technicians.filter((t) => {
    const words = normalizeName(t.name).split(' ');
    if (!words[0]) return false;
    const [shorter, longer] = words.length <= wantedWords.length ? [words, wantedWords] : [wantedWords, words];
    return shorter.every((word) => longer.includes(word));
  });
  if (close.length === 1 && exact.length === 0) return { technician: close[0], how: 'suggested' };

  return { technician: null, how: null };
}
