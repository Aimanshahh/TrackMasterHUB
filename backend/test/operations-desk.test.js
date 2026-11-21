import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';

import { renderTemplate, placeholdersIn } from '../src/utils/messageTemplates.js';
import { closeTestDb, connectTestDb, hasDb } from './helpers.js';

const skip = hasDb ? false : 'set TEST_MONGO_URI to run database tests';
const rejects = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(e.message));

/* ---------- pure rules ---------- */

test('templates fill known placeholders, hide the password in the saved copy and list what is missing', () => {
  const customer = { name: 'Ali Khan', phone: '03001234567', appLogin: 'ali@example.com', appPassword: 's3cret!' };
  const body = 'Hi [Customer Name], your app login is [Login Email] and password is [Password].';
  const out = renderTemplate(body, customer);
  assert.equal(out.text, 'Hi Ali Khan, your app login is ali@example.com and password is s3cret!.');
  assert.ok(!out.logText.includes('s3cret!'), 'the saved copy never holds the password');
  assert.ok(out.logText.includes('ali@example.com'));
  assert.deepEqual(out.missing, []);

  const none = renderTemplate(body, { name: 'Sara' });
  assert.deepEqual(none.missing, ['Login Email', 'Password']);
  assert.ok(none.text.includes('[Login Email]'), 'a missing value is left visible, never sent as blank');

  assert.equal(placeholdersIn('Hello [customer name] and [Nonsense]').filter((p) => !p.variable).length, 1);
});

test('routes: the desk screens are for admin and operations only', async () => {
  const { operationsRouter } = await import('../src/modules/operations/operations.routes.js');
  const run = (guard, role) => new Promise((resolve) => guard({ user: { role } }, {}, (err) => resolve(err ?? null)));
  const paths = [['get', '/customers'], ['get', '/customers/:id'], ['get', '/message-templates'], ['post', '/message-templates'], ['post', '/whatsapp/preview'], ['post', '/whatsapp/send']];
  for (const [method, path] of paths) {
    const layer = operationsRouter.stack.find((l) => l.route?.path === path && l.route.methods[method]);
    assert.ok(layer, `${method} ${path} exists`);
    const guard = layer.route.stack[0].handle;
    for (const role of ['admin', 'operations']) assert.equal(await run(guard, role), null, `${role} may use ${path}`);
    for (const role of ['manager', 'salesperson']) assert.ok(await run(guard, role), `${role} is blocked from ${path}`);
  }
});

/* ---------- database ---------- */

let ctx;
before(async () => { if (!hasDb) return; await connectTestDb(); ctx = {}; });
after(async () => { if (hasDb) await closeTestDb(); });

test('customer search returns nothing until there is a search, then finds by name, phone and registration', { skip }, async () => {
  const { default: User } = await import('../src/models/User.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { searchCustomers, getCustomerProfile } = await import('../src/modules/operations/customers.service.js');

  const admin = await User.create({ name: 'Desk Admin', email: 'desk-admin@example.com', passwordHash: 'a-long-test-password', role: 'admin' });
  ctx.adminId = admin._id.toString();
  const ali = await Customer.create({ name: 'Ali Khan', phone: '0300-1112233', appLogin: 'ali@example.com', appPassword: 'pw-ali', briefing: { cnic: '1234512345671' } });
  await Customer.create({ name: 'Alina Raza', phone: '03214445566' });
  for (const [i, reg] of ['LEA-1001(LOC)', 'LEA-1001(IMB)', 'LEB-2002'].entries()) {
    await Job.create({ createdBy: admin._id, customer: ali._id, customerName: ali.name, requestType: 'new_installation', status: 'completed', vehicle: { registration: reg }, deviceImei: `35600000000000${i}` });
  }
  for (let i = 0; i < 30; i += 1) await Customer.create({ name: `Bulk Customer ${i}`, phone: `0333000${String(i).padStart(4, '0')}` });

  // Nothing is shown without a search.
  for (const blank of [undefined, '', ' ', 'a']) {
    const empty = await searchCustomers({ search: blank });
    assert.equal(empty.data.length, 0);
    assert.equal(empty.meta.searched, false);
  }

  const byName = await searchCustomers({ search: 'ali' });
  assert.deepEqual(byName.data.map((c) => c.name).sort(), ['Ali Khan', 'Alina Raza']);
  assert.equal(byName.data.find((c) => c.name === 'Ali Khan').vehicleCount, 2, 'a two-device vehicle counts once');

  const byPhone = await searchCustomers({ search: '03001112233' });
  assert.deepEqual(byPhone.data.map((c) => c.name), ['Ali Khan']);

  const byPlate = await searchCustomers({ search: 'lea 1001' });
  assert.deepEqual(byPlate.data.map((c) => c.name), ['Ali Khan']);
  assert.equal(byPlate.data[0].matchedVrn, 'LEA-1001');
  assert.deepEqual((await searchCustomers({ search: 'LEB2002' })).data.map((c) => c.name), ['Ali Khan']);

  // Results stay small.
  const many = await searchCustomers({ search: 'bulk customer', limit: 500 });
  assert.ok(many.data.length <= 25 && many.meta.more === true);
  assert.equal((await searchCustomers({ search: 'bulk customer', limit: 5 })).data.length, 5);

  // The desk profile has the app login and vehicles, but no briefing and no money.
  const profile = await getCustomerProfile(ali._id.toString());
  assert.equal(profile.customer.appLogin, 'ali@example.com');
  assert.equal(profile.customer.appPassword, 'pw-ali');
  assert.equal(profile.customer.briefing, undefined);
  assert.equal(profile.jobs.length, 3);
  assert.equal(profile.invoices.length, 0);
  assert.ok(profile.jobs.every((job) => job.quotedPrice === undefined || job.quotedPrice === null));
  ctx.aliId = ali._id.toString();
});

test('two templates are seeded, new ones can be added and bad ones are refused', { skip }, async () => {
  const svc = await import('../src/modules/operations/whatsapp.service.js');
  const first = await svc.listTemplates();
  assert.deepEqual(first.data.map((t) => t.name).sort(), ['Helpline Numbers', 'Login Details']);
  assert.equal((await svc.listTemplates()).data.length, 2, 'seeding twice adds nothing');

  const made = await svc.createTemplate({ name: 'AMC Reminder', body: 'Hi [Customer Name], your AMC is due. Call [Helpline Number].' }, { id: ctx.adminId });
  assert.equal(made.builtIn, false);
  assert.equal((await svc.listTemplates()).data.length, 3);

  await rejects(svc.createTemplate({ name: 'Bad', body: 'Hi [Customer Name], your [Balance] is due.' }, { id: ctx.adminId }), /\[Balance\] cannot be filled in/);
  await rejects(svc.createTemplate({ name: 'amc reminder', body: 'Hi [Customer Name], hello again.' }, { id: ctx.adminId }), /already exists/);
  await rejects(svc.createTemplate({ name: 'X', body: 'short' }, { id: ctx.adminId }), /name/);
  await rejects(svc.createTemplate({ name: 'Empty', body: '' }, { id: ctx.adminId }), /message/);
});

test('preview fills the customer values; sending goes through the gateway and adds a history event', { skip }, async () => {
  const svc = await import('../src/modules/operations/whatsapp.service.js');
  const { env } = await import('../src/config/env.js');
  const { default: Customer } = await import('../src/models/Customer.js');
  const { default: DirectMessage } = await import('../src/models/DirectMessage.js');
  const { default: TimelineEvent } = await import('../src/models/TimelineEvent.js');
  const history = await import('../src/modules/customers/history.service.js');

  const templates = (await svc.listTemplates()).data;
  const login = templates.find((t) => t.name === 'Login Details');
  const helpline = templates.find((t) => t.name === 'Helpline Numbers');

  // Preview, with the customer's own login filled in.
  const preview = await svc.previewMessage({ templateId: login.id, customerId: ctx.aliId });
  assert.equal(preview.text, 'Hi Ali Khan, your app login is ali@example.com and password is pw-ali.');
  assert.equal(preview.canSend, true);

  // A customer with no login saved cannot be sent the login template.
  const bare = await Customer.create({ name: 'No Login Nadia', phone: '03005550123' });
  const bad = await svc.previewMessage({ templateId: login.id, customerId: bare._id.toString() });
  assert.equal(bad.canSend, false);
  assert.deepEqual(bad.missing.map((m) => m.name), ['Login Email', 'Password']);
  await rejects(svc.sendTemplateMessage({ templateId: login.id, customerId: bare._id.toString() }, { id: ctx.adminId }), /cannot be sent yet/);

  // A helpline number must be set on the server before that template can go out.
  const previousUrl = env.whatsappGatewayUrl;
  const previousHelpline = env.helplineNumber;
  env.helplineNumber = '';
  assert.equal((await svc.previewMessage({ templateId: helpline.id, customerId: ctx.aliId })).canSend, false);

  // Not configured: recorded, nothing sent, no history event.
  env.whatsappGatewayUrl = '';
  env.helplineNumber = '111-222-333';
  const notSent = await svc.sendTemplateMessage({ templateId: helpline.id, customerId: ctx.aliId }, { id: ctx.adminId });
  assert.equal(notSent.sent, false);
  assert.equal(await TimelineEvent.countDocuments({ customer: ctx.aliId, kind: 'whatsapp' }), 0);

  // A fake gateway that records what it receives, then fails once.
  const received = [];
  let failNext = false;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      received.push({ body: JSON.parse(raw), key: req.headers['x-api-key'] });
      res.writeHead(failNext ? 500 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(failNext ? { error: 'session offline' } : { ok: true }));
    });
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  env.whatsappGatewayUrl = `http://127.0.0.1:${server.address().port}/api/send-update`;

  try {
    const sent = await svc.sendTemplateMessage({ templateId: login.id, customerId: ctx.aliId }, { id: ctx.adminId });
    assert.equal(sent.sent, true);
    assert.deepEqual(received[0].body, { phoneNumber: '03001112233', customerName: 'Ali Khan', message: 'Hi Ali Khan, your app login is ali@example.com and password is pw-ali.' });

    // The history gets "WhatsApp Sent: <template>", and the saved message hides the password.
    const events = await TimelineEvent.find({ customer: ctx.aliId, kind: 'whatsapp' });
    assert.equal(events.length, 1);
    assert.equal(events[0].toApiJson().title, 'WhatsApp Sent: Login Details');
    const saved = await DirectMessage.find({ customer: ctx.aliId, status: 'sent' });
    assert.equal(saved.length, 1);
    assert.ok(!saved[0].body.includes('pw-ali'));
    const shown = await history.getCustomerHistory(ctx.aliId, { id: ctx.adminId, role: 'operations' });
    assert.ok(shown.timeline.some((e) => e.title === 'WhatsApp Sent: Login Details' && e.at));

    // A gateway failure is reported, and no history event is added.
    failNext = true;
    const failed = await svc.sendTemplateMessage({ templateId: helpline.id, customerId: ctx.aliId }, { id: ctx.adminId });
    assert.equal(failed.sent, false);
    assert.match(failed.error, /session offline/);
    assert.equal(await TimelineEvent.countDocuments({ customer: ctx.aliId, kind: 'whatsapp' }), 1);
  } finally {
    server.close();
    env.whatsappGatewayUrl = previousUrl;
    env.helplineNumber = previousHelpline;
  }
});

test('the import maps App Login and App Password, and fills them on a customer that already exists without overwriting', { skip }, async () => {
  const { default: Customer } = await import('../src/models/Customer.js');
  const svc = await import('../src/modules/imports/imports.service.js');
  const actor = { id: ctx.adminId, role: 'admin' };
  const run = async (csv, name) => {
    const up = await svc.createBatchFromUpload(Buffer.from(csv), name, actor);
    for (const key of ['appLogin', 'appPassword']) if (/App/i.test(csv.split('\n')[0])) assert.ok(up.batch.mapping[key], `${key} is matched`);
    const prev = await svc.previewBatch(up.batch.id, { mapping: up.batch.mapping });
    assert.equal(prev.batch.summary.errors, 0, JSON.stringify(prev.batch.summary));
    await svc.confirmBatch(up.batch.id, { previewHash: prev.batch.previewHash }, actor);
  };

  await run('Customer Name,Phone,VRN,App Login,App Password\nLogin Larry,03007770001,LGN-1,larry@example.com,larry-pass', 'logins.csv');
  const larry = await Customer.findOne({ name: 'Login Larry' });
  assert.equal(larry.appLogin, 'larry@example.com');
  assert.equal(larry.appPassword, 'larry-pass');

  // Same vehicle again with different values: nothing is overwritten.
  await run('Customer Name,Phone,VRN,App Login,App Password\nLogin Larry,03007770001,LGN-1,other@example.com,other-pass', 'logins-2.csv');
  assert.equal((await Customer.findById(larry._id)).appLogin, 'larry@example.com');

  // An existing customer with no login gets it filled from the sheet.
  const empty = await Customer.create({ name: 'Empty Eddie', phone: '03007770002' });
  await run('Customer Name,Phone,VRN,App Login,App Password\nEmpty Eddie,03007770002,EDD-1,eddie@example.com,eddie-pass', 'logins-3.csv');
  const eddie = await Customer.findById(empty._id);
  assert.equal(eddie.appLogin, 'eddie@example.com');
  assert.equal(eddie.appPassword, 'eddie-pass');
});
