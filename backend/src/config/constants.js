/** Role hierarchy: a higher role can act on a lower one. */
export const ROLES = ['admin', 'manager', 'operations', 'salesperson', 'technician']
export const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  operations: 'Operations',
  salesperson: 'Salesperson',
  technician: 'Technician',
}

/** Roles an admin can create an account for. The admin role itself is not assignable. */
export const ASSIGNABLE_ROLES = ['manager', 'operations', 'salesperson', 'technician'];

export const MIN_PASSWORD_LENGTH = 8;
export const DEFAULT_SESSION_TTL_DAYS = 7;

/** How long the setup flow needs the bootstrap token before it expires. */
export const BOOTSTRAP_TOKEN_TTL_SECONDS = 3600;
