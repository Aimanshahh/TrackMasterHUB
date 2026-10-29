const adminGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin', label: 'Overview', icon: 'overview', end: true },
      { to: '/admin/customers', label: 'Customers', icon: 'customers' },
      { to: '/admin/follow-ups', label: 'Follow-ups', icon: 'followup' },
      { to: '/admin/sales', label: 'Sales', icon: 'sales' },
    ],
  },
  {
    label: 'Field',
    items: [
      { to: '/admin/operations', label: 'Operations', icon: 'operations' },
      { to: '/admin/complaints', label: 'Complaints', icon: 'complaints' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/pricing', label: 'Pricing', icon: 'pricing' },
      { to: '/admin/users', label: 'Users', icon: 'users' },
      { to: '/admin/activity', label: 'Activity', icon: 'activity' },
      { to: '/admin/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const operationsGroups = [
  {
    label: 'Operations',
    items: [
      { to: '/operations', label: 'Overview', icon: 'overview', end: true },
      { to: '/operations/queue', label: 'Work queue', icon: 'operations' },
      { to: '/operations/complaints', label: 'Complaints', icon: 'complaints' },
    ],
  },
  {
    label: 'Stock & field',
    items: [
      { to: '/operations/inventory', label: 'Inventory', icon: 'pricing' },
      { to: '/operations/technicians', label: 'Technicians', icon: 'users' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { to: '/operations/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/operations/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

/** Flat list used by the topbar to resolve the current section. */
function flatten(groups) {
  return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
}

export const adminNavigationItems = flatten(adminGroups);
export const operationsNavigationItems = flatten(operationsGroups);

export { adminGroups, operationsGroups };
