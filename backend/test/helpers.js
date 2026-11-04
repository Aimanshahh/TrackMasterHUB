import mongoose from 'mongoose';

/**
 * Database tests run only when TEST_MONGO_URI points at a MongoDB server. Each
 * run gets its own throwaway database, dropped at the end, so tests never touch
 * real data. Without the variable those tests are skipped, not failed.
 */
export const hasDb = Boolean(process.env.TEST_MONGO_URI);

export async function connectTestDb() {
  const dbName = `trackmaster_test_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 8000 });
  return dbName;
}

export async function closeTestDb() {
  try {
    await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}

/** One admin, one salesperson, one customer and one completed installation. */
export async function seedBasics({ price = 20000, email = 'owner@example.com' } = {}) {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');

  const admin = await User.create({ name: 'Test Admin', email: 'admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  const sales = await User.create({ name: 'Test Sales', email: 'sales@example.com', passwordHash: 'a-long-test-password', role: 'salesperson' });

  const customer = await Customer.create({
    name: 'Basheer Ahmed',
    phone: '03001234567',
    email,
    owner: sales._id,
  });

  const job = await Job.create({
    customer: customer._id,
    customerName: customer.name,
    phone: customer.phone,
    requestType: 'new_installation',
    vehicle: { label: 'Corolla GLi', registration: 'AYM-118', station: 'Rawalpindi' },
    status: 'completed',
    completedAt: new Date('2026-10-20T10:00:00Z'),
    packageKey: 'basic',
    listPrice: 15000,
    quotedPrice: price,
    createdBy: sales._id,
    history: [{ status: 'unassigned', note: 'Job created.', at: new Date('2026-10-18T09:00:00Z') }],
  });

  return { admin, sales, customer, job, actor: { id: admin._id.toString(), role: 'admin' } };
}

let jobCounter = 0;

/** Another completed installation for the same customer (one invoice per job). */
export async function makeCompletedJob(ctx, { price = 20000, registration } = {}) {
  const { default: Job } = await import('../src/models/Job.js');
  jobCounter += 1;

  return Job.create({
    customer: ctx.customer._id,
    customerName: ctx.customer.name,
    phone: ctx.customer.phone,
    requestType: 'new_installation',
    vehicle: { label: 'Test vehicle', registration: registration ?? `TST-${100 + jobCounter}`, station: 'Rawalpindi' },
    status: 'completed',
    completedAt: new Date(),
    packageKey: 'basic',
    listPrice: 15000,
    quotedPrice: price,
    createdBy: ctx.sales._id,
  });
}
