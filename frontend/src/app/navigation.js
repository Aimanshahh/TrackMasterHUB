const adminGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin', label: 'Overview', icon: 'overview', end: true },
      { to: '/admin/customers', label: 'Customers', icon: 'customers' },
      { to: '/admin/import', label: 'Customer import', icon: 'customers' },
      { to: '/admin/follow-ups', label: 'Follow-ups', icon: 'followup' },
      { to: '/admin/messages', label: 'WhatsApp messages', icon: 'followup' },
      { to: '/admin/sales', label: 'Sales', icon: 'sales' },
      { to: '/admin/quotations', label: 'Quotations', icon: 'approvals' },
    ],
  },
  {
    label: 'Field',
    items: [
      { to: '/admin/operations', label: 'Operations', icon: 'operations' },
      { to: '/admin/pending-installations', label: 'Pending installations', icon: 'operations' },
      { to: '/admin/vehicles', label: 'Vehicles', icon: 'operations' },
      { to: '/admin/certificates', label: 'Certificates', icon: 'approvals' },
      { to: '/admin/complaints', label: 'Complaints', icon: 'complaints' },
      { to: '/admin/calls', label: 'Call logs', icon: 'followup' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { to: '/admin/sales-performance', label: 'Sales performance', icon: 'sales' },
      { to: '/admin/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/pricing', label: 'Pricing', icon: 'pricing' },
      { to: '/admin/approvals', label: 'Approvals', icon: 'approvals' },
      { to: '/admin/money', label: 'Money records', icon: 'approvals' },
      { to: '/admin/technician-payments', label: 'Technician payments', icon: 'users' },
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
      { to: '/operations', label: 'Today', icon: 'overview', end: true },
      { to: '/operations/queue', label: 'Work queue', icon: 'operations' },
      { to: '/operations/pending-installations', label: 'Pending installations', icon: 'followup' },
      { to: '/operations/customers', label: 'Customers', icon: 'customers' },
      { to: '/operations/vehicles', label: 'Vehicles', icon: 'operations' },
      { to: '/operations/complaints', label: 'Complaints', icon: 'complaints' },
      { to: '/operations/calls', label: 'Call logs', icon: 'followup' },
      { to: '/operations/whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
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
    label: 'Service',
    items: [
      { to: '/operations/reviews', label: 'Testing review', icon: 'approvals' },
      { to: '/operations/microphones', label: 'Microphones', icon: 'followup' },
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
      { to: '/manager/briefing-pending', label: 'Briefing pending', icon: 'followup' },
      { to: '/manager/vehicles', label: 'Vehicles', icon: 'operations' },
      { to: '/manager/certificates', label: 'Certificates', icon: 'approvals' },
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
      { to: '/salesperson/hot-leads', label: 'Hot leads', icon: 'followup' },
      { to: '/salesperson/quotations', label: 'Quotations', icon: 'approvals' },
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

const technicianGroups = [
  {
    label: 'My work',
    items: [
      { to: '/technician', label: 'Today', icon: 'overview', end: true },
      { to: '/technician/installations', label: 'Installations', icon: 'operations' },
      { to: '/technician/stock', label: 'My stock', icon: 'pricing' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/technician/earnings', label: 'Earnings', icon: 'sales' },
      { to: '/technician/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

/** Phone-sized primary navigation for the field workspace. */
const technicianTabs = [
  { to: '/technician', label: 'Today', icon: 'overview', end: true },
  { to: '/technician/installations', label: 'Jobs', icon: 'operations' },
  { to: '/technician/stock', label: 'Stock', icon: 'pricing' },
  { to: '/technician/earnings', label: 'Earnings', icon: 'sales' },
];

/** Flat list used by the topbar to resolve the current section. */
function flatten(groups) {
  return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
}

export const adminNavigationItems = flatten(adminGroups);
export const salespersonNavigationItems = flatten(salespersonGroups);
export const operationsNavigationItems = flatten(operationsGroups);
export const managerNavigationItems = flatten(managerGroups);
export const technicianNavigationItems = flatten(technicianGroups);

export {
  adminGroups,
  operationsGroups,
  salespersonGroups,
  salespersonTabs,
  managerGroups,
  technicianGroups,
  technicianTabs,
};
