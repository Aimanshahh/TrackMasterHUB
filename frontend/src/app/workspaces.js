import {
  adminGroups,
  adminNavigationItems,
  operationsGroups,
  operationsNavigationItems,
  salespersonGroups,
  salespersonNavigationItems,
  salespersonTabs,
} from './navigation.js';

/**
 * One workspace definition per role interface. Layout, sidebar, topbar and page
 * headings all read from here so the admin and operations areas stay visually
 * consistent without duplicating shell code.
 */
const adminPages = [
  { match: /^\/admin\/?$/, title: 'Business overview', description: 'A clear view of the records and activity currently available in TrackMaster Hub.' },
  { match: /^\/admin\/customers/, title: 'Customers', description: 'Search and review customer records stored in the business database.' },
  { match: /^\/admin\/follow-ups/, title: 'Follow-ups', description: 'Review customer follow-up work recorded by the team.' },
  { match: /^\/admin\/sales/, title: 'Sales', description: 'Sales and approval information will appear here when the sales workflow is connected.' },
  { match: /^\/admin\/operations/, title: 'Operations queue', description: 'Installation work items, technician assignment and station-level stock allocation.' },
  { match: /^\/admin\/complaints/, title: 'Complaints', description: 'Recorded service tickets and their resolution progress.' },
  { match: /^\/admin\/reports/, title: 'Reports', description: 'Business summaries will be available as verified records are collected.' },
  { match: /^\/admin\/pricing/, title: 'Pricing', description: 'The package rates every installation quote starts from.' },
  { match: /^\/admin\/approvals/, title: 'Price approvals', description: 'Installations quoted below the package rate, waiting on your decision.' },
  { match: /^\/admin\/users/, title: 'User access', description: 'Create and review accounts for Admin, Salesperson, Manager and Operations roles.' },
  { match: /^\/admin\/activity/, title: 'Activity log', description: 'A trace of changes recorded by the backend.' },
  { match: /^\/admin\/settings/, title: 'Settings', description: 'Workspace access and service health.' },
];

const operationsPages = [
  { match: /^\/operations\/?$/, title: 'Operations overview', description: 'Live workload, stock position and technician availability from the business database.' },
  { match: /^\/operations\/queue/, title: 'Work queue', description: 'Installation and follow-up work pushed by the sales team, ready for assignment.' },
  { match: /^\/operations\/complaints/, title: 'Complaints', description: 'Service tickets logged by the team and their resolution progress.' },
  { match: /^\/operations\/inventory/, title: 'Inventory', description: 'Device stock by IMEI and SIM stock held at each station.' },
  { match: /^\/operations\/technicians/, title: 'Technicians', description: 'Field technicians registered by operations, with their home station.' },
  { match: /^\/operations\/reports/, title: 'Operations reports', description: 'Workload, completion and stock totals currently recorded.' },
  { match: /^\/operations\/settings/, title: 'Settings', description: 'Your workspace access and how operational data is protected.' },
];

const salespersonPages = [
  { match: /^\/salesperson\/?$/, title: 'My day', description: 'Your portfolio, follow-ups and requests, scoped to your own account.' },
  { match: /^\/salesperson\/customers\/[^/]+$/, title: 'Customer record', description: 'The full profile, follow-up plan and work history for this customer.' },
  { match: /^\/salesperson\/customers/, title: 'My customers', description: 'Every customer you own, with follow-up dates and priority.' },
  { match: /^\/salesperson\/follow-ups/, title: 'Follow-ups', description: 'Customers due for a call or visit, ordered by date.' },
  { match: /^\/salesperson\/requests/, title: 'Installation requests', description: 'Requests you pushed to operations and where they currently stand.' },
  { match: /^\/salesperson\/complaints/, title: 'Complaints', description: 'Tickets you logged and the resolution progress from operations.' },
  { match: /^\/salesperson\/sales/, title: 'Sales & renewals', description: 'Quotations, renewals and approvals will appear here once the sales workflow is connected.' },
  { match: /^\/salesperson\/settings/, title: 'Settings', description: 'Your account, workspace access and notification behaviour.' },
];

export const adminWorkspace = {
  id: 'admin',
  label: 'Admin',
  eyebrow: 'TRACKMASTER HUB · ADMIN',
  homePath: '/admin',
  settingsPath: '/admin/settings',
  navHeading: 'ADMIN WORKSPACE',
  navGroups: adminGroups,
  navItems: adminNavigationItems,
  pages: adminPages,
};

export const salespersonWorkspace = {
  id: 'salesperson',
  label: 'Salesperson',
  eyebrow: 'TRACKMASTER HUB · SALESPERSON',
  homePath: '/salesperson',
  settingsPath: '/salesperson/settings',
  navHeading: 'SALES DESK',
  navGroups: salespersonGroups,
  navItems: salespersonNavigationItems,
  tabs: salespersonTabs,
  pages: salespersonPages,
};

export const operationsWorkspace = {
  id: 'operations',
  label: 'Operations',
  eyebrow: 'TRACKMASTER HUB · OPERATIONS',
  homePath: '/operations',
  settingsPath: '/operations/settings',
  navHeading: 'OPERATIONS DESK',
  navGroups: operationsGroups,
  navItems: operationsNavigationItems,
  pages: operationsPages,
};
