/**
 * Pakistani numbers show up as 03452511122, +92 345 2511122, 923452511122 and
 * 0345-2511122. The last ten digits identify the subscriber in all of them.
 */
export function phoneKey(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  return digits.slice(-10);
}

/** A regex that finds a stored phone value ending in the same ten digits, whatever punctuation it uses. */
export function phoneRegexFor(key) {
  if (key.length !== 10) return null;
  return new RegExp(`${key.split('').join('\\D*')}\\D*$`);
}
