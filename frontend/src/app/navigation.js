import { NavIcon } from './NavIcon.jsx';

const groups = [
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

export const navigationItems = groups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

export { groups };
