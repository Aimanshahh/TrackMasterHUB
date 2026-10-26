export const navigation = [
  { label: 'Platform', to: '/#platform' },
  { label: 'Interfaces', to: '/#roles' },
  { label: 'Workflow', to: '/#workflow' },
  { label: 'Standards', to: '/#standards' },
];

export const coverage = [
  'Customer records',
  'Quotations',
  'Pricing approvals',
  'Renewals',
  'Operations queue',
  'OS tickets',
  'Invoicing',
  'Payments',
];

export const capabilities = [
  {
    title: 'Customer records',
    body: 'Account IDs, contacts, category, priority, owner, notes and follow-up dates held in one profile instead of five spreadsheets.',
  },
  {
    title: 'Sales & pricing policy',
    body: 'Quotations and sale submissions priced against centrally managed packages, with below-minimum pricing routed for approval.',
  },
  {
    title: 'Renewals & follow-ups',
    body: 'Due and overdue renewals surfaced per portfolio, with contact attempts, customer response and the next action recorded.',
  },
  {
    title: 'Field operations',
    body: 'One queue for submitted work: assignment, scheduling, progress, visit notes, evidence and completion outcome.',
  },
  {
    title: 'OS Ticket System',
    body: 'Complaints and service issues tracked from intake to resolution, with customer updates by email and WhatsApp logged per channel.',
  },
  {
    title: 'Invoicing & payments',
    body: 'Invoices finalised by the Manager, payments recorded independently, outstanding balances and certificate references attached.',
  },
];

export const roles = [
  {
    name: 'Admin',
    mandate: 'Business-wide control',
    description:
      'Full visibility of customers, users and pricing policy, with approvals and ownership changes on the record.',
    items: ['All customer records', 'Users, roles and access', 'Pricing and approvals', 'Audit history'],
  },
  {
    name: 'Salesperson',
    mandate: 'Own portfolio',
    description:
      'A mobile-first workspace for the people closest to the customer, restricted to their own accounts.',
    items: ['Customer creation', 'Follow-ups and notes', 'Sales and renewals', 'Redo requests and tickets'],
  },
  {
    name: 'Manager',
    mandate: 'Invoice authority',
    description:
      'The billing desk: customer lookup, verified tracking data and the authority to finalise and issue invoices.',
    items: ['Customer and account lookup', 'Invoice finalisation', 'Payments and balances', 'Certificates'],
  },
  {
    name: 'Operations',
    mandate: 'Field execution',
    description:
      'A separate operational workspace for the work itself, from assignment and scheduling to sign-off.',
    items: ['Work queue and assignment', 'Scheduling and priority', 'Progress and evidence', 'Complaint resolution'],
  },
];

export const workflowSteps = [
  {
    index: '01',
    title: 'Customer record',
    body: 'Created by the salesperson. The backend assigns ownership and checks for likely duplicates.',
  },
  {
    index: '02',
    title: 'Quotation or sale',
    body: 'Package and price selected against the pricing policy that is current at submission.',
  },
  {
    index: '03',
    title: 'Approval where needed',
    body: 'Below-minimum pricing waits for Admin sign-off, with approver, reason and timestamp recorded.',
  },
  {
    index: '04',
    title: 'Operations queue',
    body: 'The job is assigned, scheduled and progressed with notes, evidence and a clear outcome.',
  },
  {
    index: '05',
    title: 'Invoice',
    body: 'The Manager finalises the invoice once the workflow requirements are met. Issued records are never silently edited.',
  },
  {
    index: '06',
    title: 'Payment & account history',
    body: 'Payments, balances and account events stay attached to the customer, independent of job status.',
  },
];

export const statusGroups = [
  'Sales',
  'Operations',
  'Renewal',
  'Invoice',
  'Payment',
  'Subscription',
];

export const standards = [
  {
    title: 'Permissions are enforced on the server',
    body: 'Every request checks the role and the customer ownership behind it. Hiding a button in the browser is never treated as security.',
  },
  {
    title: 'Pricing decisions stay traceable',
    body: 'The policy version used at submission is stored with the sale. Approvals carry the approver, the reason and the time.',
  },
  {
    title: 'Records are corrected, not erased',
    body: 'Ownership changes, priority changes, issued invoices and payments keep an audit history rather than being overwritten.',
  },
  {
    title: 'One API for every interface',
    body: 'Admin, Salesperson, Manager and Operations are role-aware views of the same data, not four copies of the business.',
  },
];

export const footerColumns = [
  {
    title: 'Platform',
    links: [
      { label: 'Customer records', to: '/#platform' },
      { label: 'Sales & approvals', to: '/#platform' },
      { label: 'Renewals', to: '/#platform' },
      { label: 'Operations', to: '/#platform' },
      { label: 'OS tickets', to: '/#platform' },
      { label: 'Invoicing', to: '/#platform' },
    ],
  },
  {
    title: 'Interfaces',
    links: [
      { label: 'Admin dashboard', to: '/#roles' },
      { label: 'Salesperson workspace', to: '/#roles' },
      { label: 'Manager desk', to: '/#roles' },
      { label: 'Operations board', to: '/#roles' },
    ],
  },
  {
    title: 'System',
    links: [
      { label: 'System status', to: '/status' },
      { label: 'API health', to: '/api/health', external: true },
      { label: 'Workflow standards', to: '/#standards' },
    ],
  },
];
