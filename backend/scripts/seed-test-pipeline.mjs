/**
 * TEST DATA — one customer walked through all four roles.
 *
 * Creates three test staff accounts, prices the three packages, then runs one
 * installation from the salesperson intake through operations, the manager's
 * briefing/invoice/part-payment and a complaint, so every workspace has a real
 * record to look at.
 *
 * Safe to re-run: it refuses to duplicate the customer and leaves existing
 * accounts and prices alone.
 *
 *   cd backend && node scripts/seed-test-pipeline.mjs
 *
 * Remove everything again with scripts/remove-test-data.mjs.
 */
import 'dotenv/config';

const BASE = process.env.SEED_API_BASE ?? 'http://localhost:4000';
const PASSWORD = 'Test@2026';
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? 'Admin@Trackmaster.com', password: process.env.SEED_ADMIN_PASSWORD ?? 'TrackMaster2026' };

const STAFF = [
  { key: 'sales', name: 'Ayesha Khan', email: 'sales.test@trackmaster.test', role: 'salesperson' },
  { key: 'ops', name: 'Bilal Ahmed', email: 'ops.test@trackmaster.test', role: 'operations' },
  { key: 'manager', name: 'Sana Iqbal', email: 'manager.test@trackmaster.test', role: 'manager' },
];

const PRICES = { basic: 22000, standard: 32000, premium: 45000 };
const MARKER = 'TEST DATA — pipeline walkthrough. Safe to delete.';

function makeClient(label) {
  const client = { label, cookie: '' };

  client.call = async (path, { method = 'GET', body, expect } = {}) => {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(client.cookie ? { Cookie: client.cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(';')[0];
      if (pair.startsWith('session=')) client.cookie = pair;
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

    if (expect !== undefined && response.status !== expect) {
      throw new Error(`[${label}] ${method} ${path} expected ${expect}, got ${response.status}: ${text.slice(0, 300)}`);
    }
    if (expect === undefined && response.status >= 400) {
      throw new Error(`[${label}] ${method} ${path} failed ${response.status}: ${text.slice(0, 300)}`);
    }

    return { status: response.status, payload };
  };

  return client;
}

async function login(client, email, password = PASSWORD) {
  const response = await client.call('/api/auth/login', { method: 'POST', body: { email, password }, expect: 200 });
  return response.payload.data.user;
}

async function findOrCreateStaff(admin, member) {
  const created = await admin
    .call('/api/users', {
      method: 'POST',
      body: { name: member.name, email: member.email, password: PASSWORD, role: member.role },
      expect: 201,
    })
    .catch((error) => {
      if (!String(error.message).includes('already exists')) throw error;
      return null;
    });

  return created?.payload.data.user.id ?? 'existing';
}

async function findCustomer(admin, phone) {
  const response = await admin.call(`/api/customers?q=${encodeURIComponent(phone)}&limit=5`, { expect: 200 });
  return response.payload.data[0] ?? null;
}

const admin = makeClient('admin');
await login(admin, ADMIN.email, ADMIN.password);
console.log('admin signed in');

/* ---------------------------------------------------------------- accounts */
const ids = {};
for (const member of STAFF) {
  await findOrCreateStaff(admin, member);
  const client = makeClient(member.key);
  ids[`${member.key}User`] = await login(client, member.email);
  ids[member.key] = client;
}
console.log('test staff ready');

/* ----------------------------------------------------------------- pricing */
for (const [key, price] of Object.entries(PRICES)) {
  await admin.call(`/api/packages/${key}`, { method: 'PATCH', body: { price }, expect: 200 });
}
console.log('package rates set:', PRICES);

/* ---------------------------------------------------------- salesperson: intake */
const existing = await findCustomer(admin, '0301-2345678');
if (existing) {
  console.log(`customer already exists (${existing.name}) — nothing duplicated`);
  console.log('run scripts/remove-test-data.mjs first if you want a fresh copy');
  process.exit(0);
}

const sales = ids.sales;

const customer = await sales.call('/api/customers', {
  method: 'POST',
  body: {
    name: 'Ahmed Raza',
    phone: '0301-2345678',
    email: 'ahmed.raza@example.com',
    company: 'Raza Traders',
    category: 'Business',
    priority: 'high',
    followUp: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    notes: `${MARKER} Customer wants live tracking for a delivery vehicle.`,
  },
  expect: 201,
});
const customerId = customer.payload.data.customer.id;

const scheduledAt = new Date(Date.now() + 2 * 86400000);
scheduledAt.setHours(11, 30, 0, 0);

const job = await sales.call('/api/operations/jobs', {
  method: 'POST',
  body: {
    customerId,
    requestType: 'new_installation',
    vehicleLabel: 'Toyota Corolla GLi',
    vehicleRegistration: 'ICT-4821',
    station: 'Islamabad',
    scheduledAt: scheduledAt.toISOString(),
    packageKey: 'standard',
    quotedPrice: 30000,
    approvalReason: 'Repeat customer; requested a small discount from the standard rate.',
    priority: 'high',
    notes: 'Customer needs the unit fitted before Friday.',
  },
  expect: 201,
});
const jobId = job.payload.data.job.id;
console.log('installation requested by salesperson (below standard rate, so approval is needed)');

/* --------------------------------------------------------------- admin: approval */
const approvals = await admin.call('/api/approvals?status=pending', { expect: 200 });
const approval = approvals.payload.data.find((row) => row.job?.id === jobId);
if (approval) {
  await admin.call(`/api/approvals/${approval.id}/decision`, {
    method: 'POST',
    body: { decision: 'approved', note: 'Approved for a repeat business customer.' },
    expect: 200,
  });
  console.log('admin approved the discounted price');
}

/* ------------------------------------------------------------ operations: fit */
const ops = ids.ops;

const technician = await ops.call('/api/operations/technicians', {
  method: 'POST',
  body: { name: 'Usman Khalid', station: 'Islamabad', phone: '0321-9876543', notes: 'Fitting team, Islamabad.' },
  expect: 201,
}).catch(async (error) => {
  if (!String(error.message).includes('already exists')) throw error;
  const list = await ops.call('/api/operations/technicians?q=Usman', { expect: 200 });
  return { payload: { data: { technician: list.payload.data[0] } } };
});

const device = await ops.call('/api/operations/devices', {
  method: 'POST',
  body: { imei: '861234567890123', station: 'Islamabad', model: 'Teltonika FMB920' },
  expect: 201,
}).catch(async (error) => {
  if (!String(error.message).includes('already')) throw error;
  return null;
});

const sim = await ops.call('/api/operations/sims', {
  method: 'POST',
  body: { number: '0345-1122334', station: 'Islamabad', operator: 'Jazz', iccid: '4100112233445566778' },
  expect: 201,
}).catch(async (error) => {
  if (!String(error.message).includes('already')) throw error;
  return null;
});

await ops.call(`/api/operations/jobs/${jobId}`, {
  method: 'PATCH',
  body: {
    technicianId: technician.payload.data.technician.id,
    deviceImei: device ? '861234567890123' : '861234567890123',
    simNumber: sim ? '0345-1122334' : '0345-1122334',
    scheduledAt: scheduledAt.toISOString(),
    status: 'completed',
    note: 'Unit fitted and tested on site. Customer shown the mobile app.',
  },
  expect: 200,
});
console.log('operations assigned the technician, IMEI and SIM, then completed the installation');

/* ------------------------------------------------------ manager: briefing + money */
const manager = ids.manager;

await manager.call(`/api/manager/customers/${customerId}/briefing`, {
  method: 'PATCH',
  body: {
    cnic: '61101-7654321-9',
    dob: '1986-02-17',
    ePin: '7391',
    secondaryPhone: '0300-5566778',
    secondaryRelation: 'Brother',
    geofenceAddress: 'House 14, Street 6, G-11/2, Islamabad',
  },
  expect: 200,
});
console.log('manager completed the security briefing and the account is active');

const queue = await manager.call('/api/manager/billing-queue', { expect: 200 });
const queued = queue.payload.data.find((row) => row.id === jobId);
if (!queued) throw new Error('the completed installation did not appear in the billing queue');

const invoice = await manager.call('/api/billing/invoices', { method: 'POST', body: { jobId }, expect: 201 });
const invoiceId = invoice.payload.data.invoice.id;
await manager.call(`/api/billing/invoices/${invoiceId}/issue`, { method: 'POST', expect: 200 });

const partPayment = await manager.call(`/api/billing/invoices/${invoiceId}/payments`, {
  method: 'POST',
  body: {
    amount: 15000,
    method: 'cash',
    receivedAt: new Date().toISOString().slice(0, 10),
    note: 'Half received at installation; balance due on the first of next month.',
  },
  expect: 201,
});
console.log(`manager issued ${invoice.payload.data.invoice.reference} and received a part payment; balance ${partPayment.payload.data.invoice.balance}`);

/* --------------------------------------------------------------- complaint flow */
const complaint = await sales.call('/api/complaints', {
  method: 'POST',
  body: {
    customerId,
    title: 'Tracking not updating in the mobile app',
    category: 'Tracking',
    priority: 'high',
    description: 'Customer reports the vehicle marker has not moved since yesterday evening.',
  },
  expect: 201,
});

await ops.call(`/api/complaints/${complaint.payload.data.complaint.id}`, {
  method: 'PATCH',
  body: {
    status: 'in_progress',
    assignToSelf: true,
    note: 'Checked the device online; testing the SIM data session.',
  },
  expect: 200,
});
console.log('salesperson logged a complaint and operations moved it to in progress');

/* --------------------------------------------------------- second lead: follow-up */
const lead = await sales.call('/api/customers', {
  method: 'POST',
  body: {
    name: 'Bilal Traders',
    phone: '0333-4455667',
    email: 'bilal.traders@example.com',
    company: 'Bilal Traders',
    category: 'Fleet',
    priority: 'normal',
    followUp: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    notes: `${MARKER} Interested in tracking four delivery vans; quote to follow.`,
  },
  expect: 201,
});
console.log('salesperson added a follow-up lead:', lead.payload.data.customer.name);

/* ------------------------------------------------------------------- summary */
console.log('\n--- test data ready ---');
console.log('Customer 1 : Ahmed Raza · ICT-4821 · Toyota Corolla GLi (installed)');
console.log('Customer 2 : Bilal Traders (follow-up lead, no vehicle yet)');
console.log('Invoice    :', invoice.payload.data.invoice.reference, '· 30,000 · 15,000 received · 15,000 outstanding');
console.log('Complaint  :', complaint.payload.data.complaint.reference, '· in progress');
console.log('\nSign in with:');
console.log(`  Admin       ${ADMIN.email} / ${ADMIN.password}`);
for (const member of STAFF) console.log(`  ${member.role.padEnd(11)} ${member.email} / ${PASSWORD}`);
console.log('\nRemove everything: cd backend && node scripts/remove-test-data.mjs');
