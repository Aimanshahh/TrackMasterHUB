process.env.CERTIFICATE_NUMBER_START = '1972';

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { closeTestDb, connectTestDb, hasDb, makeCompletedJob, seedBasics } from './helpers.js';

const { renderCertificatePdf } = await import('../src/modules/certificates/certificate.pdf.js');
const { addMonths } = await import('../src/modules/certificates/certificates.service.js');

test('addMonths keeps the day and clamps to month end', () => {
  assert.equal(addMonths(new Date('2026-09-25T00:00:00Z'), 12).toISOString().slice(0, 10), '2027-09-25');
  assert.equal(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10), '2026-02-28');
});

test('the PDF renderer produces a real PDF, including for a cancelled certificate', async () => {
  const base = {
    number: 'TM-1', status: 'active', issuedAt: '2026-10-24', installedAt: '2026-09-25', expiresAt: '2027-09-25', showCnic: true,
    customer: { name: 'Mr Qurban Ali', phone: '0331', cnic: '15287-130398', address: 'Karachi' },
    vehicle: { registration: 'JE-9197', makeModel: 'Mazda', engineNo: 'S.12048', chassisNo: '305532', colour: 'White', deviceImei: '' },
  };
  const a = await renderCertificatePdf(base);
  const b = await renderCertificatePdf({ ...base, status: 'cancelled' });
  assert.equal(a.subarray(0, 5).toString(), '%PDF-');
  assert.equal(b.subarray(0, 5).toString(), '%PDF-');
  assert.ok(a.length > 5000);
});

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
let ctx;
let svc;
const actor = () => ({ id: ctx.admin._id.toString(), role: 'manager' });
const rejects = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(e.message));

before(async () => {
  if (!hasDb) return;
  await connectTestDb();
  ctx = await seedBasics();
  svc = await import('../src/modules/certificates/certificates.service.js');
});

after(async () => {
  if (hasDb) await closeTestDb();
});

test('search finds a customer by plate and lists vehicles with no certificate yet', { skip }, async () => {
  const rows = await svc.searchCertificateCustomers({ q: 'aym-118' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].vehicles.length, 1);
  assert.equal(rows[0].vehicles[0].certificate, null);
});

test('issuing numbers certificates from the configured start, saves vehicle details and blocks a second active one', { skip }, async () => {
  const [cert] = await svc.issueCertificates({
    customerId: ctx.customer._id.toString(),
    vehicles: [{ jobId: ctx.job._id.toString(), engineNo: 'E-1', chassisNo: 'C-1', colour: 'White', makeModel: 'Corolla' }],
    customer: { cnic: '35202-1111111-1', address: 'Karachi' },
  }, actor());
  assert.equal(cert.number, 'TM-1972');
  assert.equal(cert.vehicle.engineNo, 'E-1');
  assert.equal(cert.customer.address, 'Karachi');
  assert.equal(cert.expiresAt.slice(0, 10), '2027-10-20');

  const { default: Job } = await import('../src/models/Job.js');
  assert.equal((await Job.findById(ctx.job._id)).vehicle.chassisNo, 'C-1');

  await rejects(svc.issueCertificates({ customerId: ctx.customer._id.toString(), vehicles: [{ jobId: ctx.job._id.toString() }] }, actor()), /already has active certificate TM-1972/);
});

test('a bad selection issues nothing, and a lead without installation is refused', { skip }, async () => {
  const other = await makeCompletedJob(ctx, { registration: 'BBB-222' });
  const { default: Job } = await import('../src/models/Job.js');
  const pending = await Job.create({ customer: ctx.customer._id, customerName: 'x', requestType: 'new_installation', vehicle: { registration: 'CCC-333' }, status: 'scheduled', createdBy: ctx.sales._id });

  await rejects(svc.issueCertificates({ customerId: ctx.customer._id.toString(), vehicles: [{ jobId: other._id.toString() }, { jobId: pending._id.toString() }] }, actor()), /no completed installation/);
  const { default: Certificate } = await import('../src/models/Certificate.js');
  assert.equal(await Certificate.countDocuments({ job: other._id }), 0);

  const [ok] = await svc.issueCertificates({ customerId: ctx.customer._id.toString(), vehicles: [{ jobId: other._id.toString() }] }, actor());
  assert.equal(ok.number, 'TM-1973');
});

test('reissue replaces the old certificate with a new number and keeps the link', { skip }, async () => {
  const list = await svc.listCertificates({ q: 'AYM-118' });
  const old = list.data[0];
  await rejects(svc.reissueCertificate(old.id, { reason: '' }, actor()), /Write why/);

  const fresh = await svc.reissueCertificate(old.id, { reason: 'Colour corrected', vehicle: { colour: 'Silver' } }, actor());
  assert.equal(fresh.reissueOf, old.id);
  assert.equal(fresh.vehicle.colour, 'Silver');
  assert.notEqual(fresh.number, old.number);

  const oldNow = (await svc.getCertificate(old.id));
  assert.equal(oldNow.status, 'superseded');
  assert.equal(oldNow.replacedBy, fresh.id);
  await rejects(svc.reissueCertificate(old.id, { reason: 'again' }, actor()), /Only an active/);
});

test('cancel needs a reason, works once, and frees the vehicle for a new certificate', { skip }, async () => {
  const list = await svc.listCertificates({ q: 'BBB-222' });
  const cert = list.data[0];
  await rejects(svc.cancelCertificate(cert.id, { reason: '' }, actor()), /Write why/);
  const done = await svc.cancelCertificate(cert.id, { reason: 'Issued by mistake' }, actor());
  assert.equal(done.status, 'cancelled');
  await rejects(svc.cancelCertificate(cert.id, { reason: 'again' }, actor()), /Only an active/);

  const [again] = await svc.issueCertificates({ customerId: ctx.customer._id.toString(), vehicles: [{ jobId: cert.jobId }] }, actor());
  assert.notEqual(again.number, cert.number);
});

test('concurrent issuing never repeats a number', { skip }, async () => {
  const jobs = await Promise.all([1, 2, 3, 4].map((n) => makeCompletedJob(ctx, { registration: `PAR-${n}00` })));
  const results = await Promise.all(jobs.map((job) => svc.issueCertificates({ customerId: ctx.customer._id.toString(), vehicles: [{ jobId: job._id.toString() }] }, actor())));
  const numbers = results.flat().map((c) => c.number);
  assert.equal(new Set(numbers).size, 4);
});

test('the customer profile and vehicle list expose certificate history', { skip }, async () => {
  const manager = await import('../src/modules/manager/manager.service.js');
  const profile = await manager.getCustomerProfile(ctx.customer._id);
  assert.ok(profile.certificates.length >= 4);
  assert.ok(profile.certificates.some((c) => c.status === 'superseded'));
});
