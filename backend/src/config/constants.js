/** Role hierarchy: a higher role can act on a lower one. */
export const ROLES = ['admin', 'manager', 'operations', 'salesperson']
export const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  operations: 'Operations',
  salesperson: 'Salesperson',
}

export const MIN_PASSWORD_LENGTH = 8;
export const DEFAULT_SESSION_TTL_DAYS = 7;

/** How long the setup flow needs the bootstrap token before it expires. */
export const BOOTSTRAP_TOKEN_TTL_SECONDS = 3600;
