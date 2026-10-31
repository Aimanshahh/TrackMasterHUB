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
      { to: '/admin/approvals', label: 'Approvals', icon: 'approvals' },
      { to: '/admin/money', label: 'Money records', icon: 'approvals' },
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

const managerGroups = [
  {
    label: 'Customer desk',
    items: [
      { to: '/manager', label: 'Overview', icon: 'overview', end: true },
      { to: '/manager/customers', label: 'Customers', icon: 'customers' },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/manager/invoices', label: 'Invoices', icon: 'pricing' },
      { to: '/manager/payments', label: 'Payments', icon: 'approvals' },
    ],
  },
  {
    label: 'Service',
    items: [
      { to: '/manager/complaints', label: 'Complaints', icon: 'complaints' },
      { to: '/manager/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/manager/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const salespersonGroups = [
  {
    label: 'My desk',
    items: [
      { to: '/salesperson', label: 'Overview', icon: 'overview', end: true },
      { to: '/salesperson/customers', label: 'My customers', icon: 'customers' },
      { to: '/salesperson/follow-ups', label: 'Follow-ups', icon: 'followup' },
    ],
  },
  {
    label: 'Requests',
    items: [
      { to: '/salesperson/requests', label: 'Installations', icon: 'operations' },
      { to: '/salesperson/complaints', label: 'Complaints', icon: 'complaints' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/salesperson/sales', label: 'Sales & renewals', icon: 'sales' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/salesperson/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

/** Phone-sized primary navigation for the field workspace. */
const salespersonTabs = [
  { to: '/salesperson', label: 'Home', icon: 'overview', end: true },
  { to: '/salesperson/customers', label: 'Customers', icon: 'customers' },
  { to: '/salesperson/requests', label: 'Requests', icon: 'operations' },
  { to: '/salesperson/complaints', label: 'Tickets', icon: 'complaints' },
  { to: '/salesperson/sales', label: 'Sales', icon: 'sales' },
];

/** Flat list used by the topbar to resolve the current section. */
function flatten(groups) {
  return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
}

export const adminNavigationItems = flatten(adminGroups);
export const salespersonNavigationItems = flatten(salespersonGroups);
export const operationsNavigationItems = flatten(operationsGroups);
export const managerNavigationItems = flatten(managerGroups);

export { adminGroups, operationsGroups, salespersonGroups, salespersonTabs, managerGroups };
