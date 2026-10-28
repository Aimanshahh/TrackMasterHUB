/** Role routing. A signed-in user is sent to their own workspace; the URL never
 * grants access by itself — the API enforces role and ownership independently. */
export const roleHome = {
  admin: '/admin',
  salesperson: '/salesperson',
  manager: '/manager',
  operations: '/operations',
};

export const roleLabels = {
  admin: 'Admin',
  salesperson: 'Salesperson',
  manager: 'Manager',
  operations: 'Operations',
};

/** Workspaces each role may open. Admin may open any of them. */
export const workspaceAccess = {
  admin: ['admin'],
  salesperson: ['salesperson', 'admin'],
  manager: ['manager', 'admin'],
  operations: ['operations', 'admin'],
};

export function homeFor(role) {
  return roleHome[role] ?? '/admin';
}

export function canOpen(role, workspace) {
  const allowed = workspaceAccess[role] ?? [];
  return allowed.includes(workspace);
}
