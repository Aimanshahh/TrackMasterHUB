import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, seedBasics } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx; let ops;

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  ops = await import('../src/modules/operations/operations.service.js');
  const { default: Package } = await import('../src/models/Package.js');
  await Package.create({ key: 'basic', price: 15500, minPrice: 11000 });
  await Package.create({ key: 'standard', price: 20000 });
});
after(async () => { if (hasDb) await closeTestDb(); });

const sell = (plate, packageKey, quotedPrice) => ops.createJob({
  customerId: ctx.customer._id.toString(), vehicleLabel: 'Car', vehicleRegistration: plate, station: 'Lahore',
  packageKey, quotedPrice, packageChecklist: packageKey === 'basic' ? ['engine_kill_call'] : ['engine_kill_app', 'one_way_voice'],
}, { id: ctx.sales._id.toString(), name: 'Sales', role: 'salesperson' });

const statusOf = (out) => (out.job ?? out).approvalStatus;

test('pricing: from the rate down to the lowest price needs no approval; below it goes to the admin', { skip }, async () => {
  assert.equal(statusOf(await sell('P-1', 'basic', 15500)), 'not_required');
  assert.equal(statusOf(await sell('P-2', 'basic', 12000)), 'not_required');
  assert.equal(statusOf(await sell('P-3', 'basic', 11000)), 'not_required');
  assert.equal(statusOf(await sell('P-4', 'basic', 10999)), 'pending', 'below the lowest price is not refused, it waits for approval');
});

test('pricing: with no lowest price set, any discount off the rate needs approval', { skip }, async () => {
  assert.equal(statusOf(await sell('P-5', 'standard', 20000)), 'not_required');
  assert.equal(statusOf(await sell('P-6', 'standard', 19000)), 'pending');
});
