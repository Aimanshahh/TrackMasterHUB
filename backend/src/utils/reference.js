import crypto from 'node:crypto';

/** Human-readable business reference, e.g. JOB-2026-4F7C. */
export function makeReference(prefix) {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}
