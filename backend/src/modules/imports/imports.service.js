import crypto from 'node:crypto';

import Activity from '../../models/Activity.js';
import Customer, { CUSTOMER_CATEGORIES } from '../../models/Customer.js';
import Counter from '../../models/Counter.js';
import ImportBatch from '../../models/ImportBatch.js';
import Job from '../../models/Job.js';
import TimelineEvent from '../../models/TimelineEvent.js';
import { coreVrn } from '../../utils/vrn.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { phoneKey } from '../../utils/phone.js';
import { suggestMapping } from './automap.js';
import { FIELD_KEYS, IMPORT_FIELDS } from './fields.js';
import { normalizeRow } from './normalize.js';
import { parseUpload } from './parse.js';

const bad = (message) => makeError(errorCodes.VALIDATION_ERROR, message);
const STALE_IMPORT_MS = 2 * 60 * 1000;

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const importFields = () => IMPORT_FIELDS.map(({ key, label, group, required }) => ({ key, label, group, required }));

function cleanMapping(input, headers) {
  const mapping = {};
  const used = new Set();
  for (const key of FIELD_KEYS) {
    const header = input?.[key];
    if (!header) continue;
    if (!headers.includes(header)) throw bad(`The column "${header}" is not in the file.`);
    if (used.has(header)) throw bad(`The column "${header}" is used for two different fields.`);
    used.add(header);
    mapping[key] = header;
  }
  if (!mapping.name) throw bad('Choose which column holds the customer name.');
  if (!mapping.phone) throw bad('Choose which column holds the phone number.');
  return mapping;
}

function cleanOptions(input, headers, mapping) {
  const mappedHeaders = new Set(Object.values(mapping ?? {}).filter(Boolean));
  const availableExtras = headers.filter((header) => !mappedHeaders.has(header));
  const requestedExtras = input?.extraHeaders;
  const extraHeaders = requestedExtras === undefined
    ? availableExtras
    : [...new Set(requestedExtras)].filter((header) => availableExtras.includes(header));

  return {
    onExisting: input?.onExisting === 'skip' ? 'skip' : 'attach',
    extraHeaders,
  };
}

/* ------------------------------------------------------------------ upload */

export async function createBatchFromUpload(buffer, fileName, actor) {
  const parsed = await parseUpload(buffer, fileName);
  const fileHash = sha(buffer);
  const earlier = await ImportBatch.findOne({ fileHash, status: 'completed' }).select('_id createdAt fileName');

  const batch = await ImportBatch.create({
    fileName: String(fileName || 'upload').slice(0, 200),
    fileType: parsed.type,
    fileHash,
    headers: parsed.headers,
    rows: parsed.rows,
    rowCount: parsed.rows.length,
    mapping: suggestMapping(parsed.headers),
    createdBy: actor.id,
  });

  return {
    batch: batch.toApiJson({ withHeaders: true }),
    sample: parsed.rows.slice(0, 5).map((row) => row.cells),
    alreadyImported: earlier ? { id: earlier._id.toString(), at: earlier.createdAt.toISOString(), fileName: earlier.fileName } : null,
    fields: importFields(),
  };
}

/* -------------------------------------------------------------------- plan */

/**
 * Decide, for every row, what would happen. Reads the database but writes nothing.
 * The same function runs for the preview and again right before the real import,
 * so what is imported is always checked against the data as it is at that moment.
 */
async function buildPlan(batch) {
  const { headers, mapping } = batch;
  const options = batch.options ?? {};
  const batchId = batch._id.toString();

  const customers = await Customer.find({}).select('name phone legacy').lean();
  const byLegacy = new Map();
  const byPhone = new Map();
  for (const customer of customers) {
    if (customer.legacy?.legacyId) byLegacy.set(String(customer.legacy.legacyId), customer);
    const key = phoneKey(customer.phone);
    if (key) byPhone.set(key, [...(byPhone.get(key) ?? []), customer]);
  }

  const jobs = await Job.find({ requestType: 'new_installation', status: { $ne: 'cancelled' } }).select('vehicle.registration customer customerName legacy').lean();
  const byPlate = new Map();
  for (const job of jobs) {
    const plate = String(coreVrn(job.vehicle?.registration)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (plate) byPlate.set(plate, job);
  }

  const fileCustomers = new Map(); // identity -> { kind, customerId?, name }
  const filePlates = new Map(); // plate -> first row number
  const results = [];
  const prepared = [];
  const selectedExtraHeaders = new Set(options.extraHeaders ?? headers);

  for (const row of batch.rows) {
    const { values, errors, warnings, extra } = normalizeRow(row.cells, headers, mapping);
    const keptExtra = Object.fromEntries(Object.entries(extra).filter(([header]) => selectedExtraHeaders.has(header)));
    const result = {
      n: row.n, status: 'ok', outcome: '', message: '', warnings: [...warnings],
      customerName: values.name, phone: values.phone, legacyId: values.legacyId, registration: values.registration,
    };
    prepared.push({ values, extra: keptExtra });

    if (errors.length) {
      Object.assign(result, { status: 'error', outcome: 'error', message: errors.join(' ') });
      results.push(result);
      continue;
    }

    // Who is this customer? Legacy ID first, then phone number.
    const identity = values.legacyId
      ? `L:${values.legacyId}`
      : values.phoneKey
        ? `P:${values.phoneKey}`
        : values.name
          ? `N:${values.name.toLowerCase().replace(/\s+/g, ' ')}`
          : `R:${row.n}`;
    let customer = fileCustomers.get(identity);

    if (!customer) {
      const legacyMatch = values.legacyId ? byLegacy.get(values.legacyId) : null;
      const phoneMatches = byPhone.get(values.phoneKey) ?? [];

      if (legacyMatch) {
        customer = { kind: legacyMatch.legacy?.batch?.toString() === batchId ? 'created_earlier' : 'existing', customerId: legacyMatch._id.toString(), name: legacyMatch.name };
        if (phoneMatches.length && !phoneMatches.some((m) => String(m._id) === String(legacyMatch._id))) {
          result.warnings.push('The phone number belongs to a different customer record. The legacy ID was used.');
        }
      } else if (phoneMatches.length === 1) {
        const match = phoneMatches[0];
        customer = { kind: match.legacy?.batch?.toString() === batchId ? 'created_earlier' : 'existing', customerId: match._id.toString(), name: match.name };
        if (values.legacyId && customer.kind === 'existing') result.warnings.push('Matched an existing customer by phone number. The legacy ID is not added to existing records.');
      } else if (phoneMatches.length > 1) {
        Object.assign(result, { status: 'error', outcome: 'error', message: `The phone number matches ${phoneMatches.length} existing customers (${phoneMatches.slice(0, 3).map((m) => m.name).join(', ')}). Fix it in the file or merge the customers first.` });
        results.push(result);
        continue;
      } else {
        customer = { kind: 'create', name: values.name, firstRow: row.n };
      }
      fileCustomers.set(identity, customer);
    }

    result.customerKind = customer.kind;
    if (customer.customerId) result.customerId = customer.customerId;

    if (customer.kind === 'existing' && options.onExisting === 'skip') {
      Object.assign(result, { status: 'skipped', outcome: 'skip_existing', message: `Existing customer ${customer.name} was left untouched.` });
      results.push(result);
      continue;
    }

    // The vehicle on this row.
    let vehicle = 'none';
    if (values.hasVehicle) {
      const existingJob = byPlate.get(values.plateKey);
      if (existingJob) {
        if (existingJob.legacy?.batch?.toString() === batchId) {
          vehicle = 'done';
        } else if (values.inspectionStatus || values.packageRaw || values.appLogin || values.appPassword) {
          // Already in the system, but the sheet knows its past (Redo, Removal, package): keep that as history only.
          vehicle = 'history';
          result.existingJobId = existingJob._id.toString();
          if (existingJob.customer) result.customerId = existingJob.customer.toString();
        } else {
          Object.assign(result, {
            status: 'skipped', outcome: 'duplicate_vehicle',
            message: `${values.registration} is already recorded${existingJob.customerName ? ` for ${existingJob.customerName}` : ''}.`,
          });
          vehicle = 'duplicate';
        }
      } else if (filePlates.has(values.plateKey)) {
        const first = filePlates.get(values.plateKey);
        // The (LOC) row and the (IMB) row of one vehicle belong together: the second becomes the vehicle's second device.
        const secondDevice = values.deviceRole && first.role && values.deviceRole !== first.role && first.identity === identity;
        if (secondDevice) {
          vehicle = 'device';
        } else {
          Object.assign(result, { status: 'skipped', outcome: 'duplicate_in_file', message: `${values.registration} also appears on row ${first.n} of this file.` });
          vehicle = 'duplicate';
        }
      } else {
        filePlates.set(values.plateKey, { n: row.n, role: values.deviceRole, identity });
        vehicle = 'create';
      }
    }
    result.vehicle = vehicle;

    // A duplicate vehicle means the row is probably a repeat or a data mix-up: skip the whole row for review.
    if (vehicle === 'duplicate') { results.push(result); continue; }

    if (vehicle === 'history') {
      Object.assign(result, { outcome: 'add_history', customerPlan: 'existing', message: `${values.registration} is already recorded. Its history from the sheet is added; nothing else is changed.` });
      results.push(result);
      continue;
    }

    if (vehicle === 'device') {
      Object.assign(result, { outcome: 'add_device', customerPlan: customer.kind === 'create' ? 'create' : customer.kind, message: `Second device (${values.deviceRole}) added to ${values.registration}.` });
      results.push(result);
      continue;
    }

    const makesCustomer = customer.kind === 'create' && !customer.planned;
    if (makesCustomer) customer.planned = true;

    if (makesCustomer && vehicle === 'create') result.outcome = 'new_customer_vehicle';
    else if (makesCustomer) result.outcome = 'new_customer';
    else if (vehicle === 'create') result.outcome = 'add_vehicle';
    else if (vehicle === 'done') result.outcome = 'already_imported';
    else Object.assign(result, { status: 'skipped', outcome: 'no_change', message: 'The customer already exists and this row adds no new vehicle.' });

    result.customerPlan = makesCustomer ? 'create' : customer.kind;
    results.push(result);
  }

  return { results, prepared, fileCustomers };
}

/** Fill the app login and password on a customer that already exists, but never overwrite what is there. */
async function fillAppLogin(customerId, values) {
  if (!customerId) return;
  if (values.appLogin) await Customer.updateOne({ _id: customerId, appLogin: { $in: [null, ''] } }, { $set: { appLogin: values.appLogin } });
  if (values.appPassword) await Customer.updateOne({ _id: customerId, appPassword: { $in: [null, ''] } }, { $set: { appPassword: values.appPassword } });
}

const COUNTED = {
  new_customer_vehicle: { customers: 1, vehicles: 1 },
  new_customer: { customers: 1, vehicles: 0 },
  add_vehicle: { customers: 0, vehicles: 1 },
  add_device: { customers: 0, vehicles: 0 },
  add_history: { customers: 0, vehicles: 0 },
};

function summarize(results) {
  const summary = { rows: results.length, newCustomers: 0, newVehicles: 0, addedToExisting: 0, duplicates: 0, addedDevices: 0, addedHistory: 0, skipped: 0, errors: 0, alreadyImported: 0, warnings: 0 };
  for (const r of results) {
    if (r.warnings?.length) summary.warnings += 1;
    if (r.status === 'error') { summary.errors += 1; continue; }
    if (r.outcome === 'duplicate_vehicle' || r.outcome === 'duplicate_in_file') summary.duplicates += 1;
    if (r.outcome === 'already_imported') summary.alreadyImported += 1;
    if (r.status === 'skipped') { summary.skipped += 1; continue; }
    if (r.outcome === 'add_device') summary.addedDevices += 1;
    if (r.outcome === 'add_history') summary.addedHistory += 1;
    const c = COUNTED[r.outcome];
    if (c) { summary.newCustomers += c.customers; summary.newVehicles += c.vehicles; }
    if (r.outcome === 'add_vehicle') summary.addedToExisting += 1;
  }
  return summary;
}

/* ------------------------------------------------------------------ preview */

export async function previewBatch(id, { mapping, options } = {}) {
  const batch = await ImportBatch.findById(id);
  if (!batch) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');
  if (['importing', 'completed'].includes(batch.status)) throw makeError(errorCodes.CONFLICT, 'This import has already been started and can no longer be changed.', 409);

  batch.mapping = cleanMapping(mapping ?? batch.mapping, batch.headers);
  batch.options = cleanOptions(options ?? batch.options, batch.headers, batch.mapping);

  const { results } = await buildPlan(batch);
  batch.results = results;
  batch.summary = summarize(results);
  batch.status = 'previewed';
  batch.previewHash = sha(JSON.stringify({ m: batch.mapping, o: batch.options, f: batch.fileHash, s: batch.summary }));
  batch.markModified('mapping');
  batch.markModified('options');
  await batch.save();

  return {
    batch: batch.toApiJson({ withHeaders: true }),
    rows: results.filter((r) => r.status === 'error').slice(0, 100).concat(results.filter((r) => r.status !== 'error').slice(0, 100)),
  };
}

/* ------------------------------------------------------------------ confirm */

export async function confirmBatch(id, { previewHash } = {}, actor) {
  const current = await ImportBatch.findById(id).select('status previewHash updatedAt startedAt summary');
  if (!current) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');

  // Retrying a finished import returns the same result and changes nothing.
  if (current.status === 'completed') return { batch: (await ImportBatch.findById(id)).toApiJson({ withHeaders: true }), repeated: true };

  const stale = current.status === 'importing' && Date.now() - current.updatedAt.getTime() > STALE_IMPORT_MS;
  if (current.status === 'importing' && !stale) throw makeError(errorCodes.CONFLICT, 'This import is already running.', 409);
  if (!['previewed', 'importing'].includes(current.status)) throw bad('Preview the import before confirming it.');
  if (!previewHash || previewHash !== current.previewHash) throw bad('The preview is out of date. Review the preview again, then confirm.');

  // Only one request may run an import. The claim is a unique-key insert, which every
  // database enforces atomically; the loser gets a duplicate-key error and stops.
  const claimKey = `import:${id}:${current.startedAt?.getTime?.() ?? 0}`;
  try {
    await Counter.create({ _id: claimKey, seq: 1 });
  } catch (error) {
    if (error?.code === 11000) throw makeError(errorCodes.CONFLICT, 'This import is already running.', 409);
    throw error;
  }
  await ImportBatch.updateOne({ _id: id }, { $set: { status: 'importing', startedAt: new Date(), error: '' } });

  const batch = await ImportBatch.findById(id);
  try {
    const { results, prepared, fileCustomers } = await buildPlan(batch);
    const now = new Date();
    const jobByPlate = new Map(); // plate -> job id created by this import, so a (LOC)/(IMB) pair shares one vehicle
    const seenEvents = new Set();

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (result.status !== 'ok' || !COUNTED[result.outcome]) continue;
      const { values, extra } = prepared[i];

      // A vehicle that was already in the system: add only its legacy history, and fill an empty AMC date. Nothing else is touched.
      if (result.outcome === 'add_history') {
        try {
          const fresh = [];
          const wanted = [];
          if (values.packageRaw) wanted.push(['package', values.packageRaw, values.packagePrice === '' ? '' : `Price ${values.packagePrice}`]);
          if (values.inspectionStatus) wanted.push(['inspection', values.inspectionStatus, values.registration]);
          for (const [kind, action, detail] of wanted) {
            const key = `${result.customerId}|${values.plateKey}|${kind}|${action}`;
            if (seenEvents.has(key)) continue;
            seenEvents.add(key);
            const already = await TimelineEvent.exists({ customer: result.customerId, vrn: values.registration, kind, action, isHistoricalData: true });
            if (!already) fresh.push({ customer: result.customerId, job: result.existingJobId, vrn: values.registration, kind, action, detail, date: null, isHistoricalData: true, batch: batch._id });
          }
          if (fresh.length) await TimelineEvent.insertMany(fresh);
          await fillAppLogin(result.customerId, values);
          if (values.amcExpiryDate) await Job.updateOne({ _id: result.existingJobId, amcExpiryDate: null }, { $set: { amcExpiryDate: values.amcExpiryDate } });
        } catch (error) {
          Object.assign(result, { status: 'error', outcome: 'error', message: `Could not save this row: ${String(error.message).slice(0, 200)}` });
        }
        continue;
      }

      const identity = values.legacyId
        ? `L:${values.legacyId}`
        : values.phoneKey
          ? `P:${values.phoneKey}`
          : values.name
            ? `N:${values.name.toLowerCase().replace(/\s+/g, ' ')}`
            : `R:${result.n}`;
      const group = fileCustomers.get(identity);

      try {
        if (result.outcome !== 'add_vehicle' && !group.customerId) {
          const customer = await Customer.create({
            name: values.name || `Imported customer row ${result.n}`,
            phone: values.phone,
            email: values.email,
            company: values.company,
            category: CUSTOMER_CATEGORIES.includes(values.category) ? values.category : '',
            address: values.address,
            appLogin: values.appLogin,
            appPassword: values.appPassword,
            notes: values.notes,
            packageKey: values.packageKey || null,
            packagePrice: values.packagePrice === '' ? null : values.packagePrice,
            packageFeatures: values.packageFeatures ?? [],
            deviceOwnership: values.deviceOwnership || 'company',
            source: 'Legacy import',
            accountStatus: 'active',
            briefingCompleted: false,
            ...(values.cnic ? { briefing: { cnic: values.cnic } } : {}),
            legacy: { imported: true, legacyId: values.legacyId || undefined, batch: batch._id, importedAt: now, extra: Object.keys(extra).length ? extra : undefined },
          });
          group.customerId = customer._id.toString();
          group.name = customer.name;
        }
        result.customerId = group.customerId;
        await fillAppLogin(group.customerId, values);
        if (group.customerId && values.packageKey) {
          await Customer.updateOne({ _id: group.customerId }, {
            $set: {
              packageKey: values.packageKey,
              packagePrice: values.packagePrice === '' ? null : values.packagePrice,
              packageFeatures: values.packageFeatures ?? [],
              deviceOwnership: values.deviceOwnership || 'company',
            },
          });
        }

        const device = (values.deviceImei || values.simNumber)
          ? { role: values.deviceRole ?? 'tracker', imei: values.deviceImei, simNumber: values.simNumber, network: values.network }
          : null;

        let jobId = null;
        if (COUNTED[result.outcome].vehicles && result.vehicle === 'create') {
          const job = await Job.create({
            customer: group.customerId,
            customerName: group.name,
            phone: values.phone,
            requestType: 'new_installation',
            status: 'completed',
            vehicle: {
              label: values.makeModel, registration: values.registration, engineNo: values.engineNo, chassisNo: values.chassisNo, colour: values.colour,
            },
            deviceImei: values.deviceImei,
            simNumber: values.simNumber,
            network: values.network,
            devices: device ? [device] : [],
            // The AMC date from the sheet is the source of truth; the tracking portal is only asked when this is empty.
            amcExpiryDate: values.amcExpiryDate ?? null,
            completedAt: values.installedDate ?? undefined,
            createdBy: actor.id,
            history: [{ status: 'completed', note: `Imported from legacy records (${batch.fileName}).`, at: now }],
            legacy: { imported: true, legacyId: values.legacyId || undefined, batch: batch._id },
          });
          result.jobId = job._id.toString();
          jobId = job._id;
          if (values.plateKey) jobByPlate.set(values.plateKey, job._id.toString());
        } else if (result.outcome === 'add_device') {
          const firstJobId = jobByPlate.get(values.plateKey);
          const job = firstJobId ? await Job.findById(firstJobId) : null;
          if (!job) throw new Error('The first row of this vehicle could not be saved, so its second device cannot be attached.');
          if (device) {
            job.devices.push(device);
            // The locator is the primary device shown everywhere a single IMEI/SIM is expected.
            if (device.role === 'locator' && (job.devices[0]?.role !== 'locator')) {
              job.deviceImei = device.imei || job.deviceImei;
              job.simNumber = device.simNumber || job.simNumber;
              job.network = device.network || job.network;
            }
          }
          if (values.amcExpiryDate && !job.amcExpiryDate) job.amcExpiryDate = values.amcExpiryDate;
          await job.save();
          result.jobId = job._id.toString();
          jobId = job._id;
        }

        // Legacy sheets carry no dates for past actions: keep each one as a dateless historical event.
        const legacyEvents = [];
        const addEvent = (kind, action, detail = '') => {
          const key = `${group.customerId}|${values.plateKey}|${kind}|${action}`;
          if (!action || seenEvents.has(key)) return;
          seenEvents.add(key);
          legacyEvents.push({ customer: group.customerId, job: jobId ?? undefined, vrn: values.registration, kind, action, detail, date: null, isHistoricalData: true, batch: batch._id });
        };
        if (values.packageRaw) addEvent('package', values.packageRaw, values.packagePrice === '' ? '' : `Price ${values.packagePrice}`);
        if (values.inspectionStatus) addEvent('inspection', values.inspectionStatus, values.registration);
        if (legacyEvents.length) await TimelineEvent.insertMany(legacyEvents);
      } catch (error) {
        Object.assign(result, { status: 'error', outcome: 'error', message: `Could not save this row: ${String(error.message).slice(0, 200)}` });
      }
    }

    batch.results = results;
    batch.markModified('results');
    batch.summary = { ...summarize(results), finished: true };
    batch.status = 'completed';
    batch.completedAt = new Date();
    await batch.save();

    await Activity.create({
      actor: actor.id,
      type: 'import.completed',
      label: `Customer import finished: ${batch.summary.newCustomers} customers, ${batch.summary.newVehicles} vehicles`,
      description: `${batch.fileName} · ${batch.summary.errors} errors, ${batch.summary.skipped} skipped`,
    });
  } catch (error) {
    batch.status = 'failed';
    batch.error = String(error.message).slice(0, 400);
    await batch.save();
    throw error;
  }

  return { batch: batch.toApiJson({ withHeaders: true }), repeated: false };
}

/* ------------------------------------------------------------------ queries */

export async function listBatches({ page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const [rows, total] = await Promise.all([
    ImportBatch.find({}).select('-rows -results').sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate('createdBy', 'name'),
    ImportBatch.countDocuments({}),
  ]);
  return { data: rows.map((row) => row.toApiJson()), meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
}

export async function getBatch(id) {
  const batch = await ImportBatch.findById(id).select('-rows').populate('createdBy', 'name');
  if (!batch) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');
  return batch.toApiJson({ withHeaders: true });
}

export async function getBatchRows(id, { status, page = 1, limit = 50 } = {}) {
  const batch = await ImportBatch.findById(id).select('results');
  if (!batch) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');
  const all = ['error', 'skipped', 'ok'].includes(status) ? batch.results.filter((r) => r.status === status) : batch.results;
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
  return { data: all.slice((safePage - 1) * safeLimit, safePage * safeLimit), meta: { total: all.length, page: safePage, limit: safeLimit, pages: Math.ceil(all.length / safeLimit) } };
}

export async function deleteBatch(id) {
  const batch = await ImportBatch.findById(id).select('status');
  if (!batch) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');
  if (batch.status === 'completed') throw makeError(errorCodes.CONFLICT, 'Completed imports cannot be deleted from history.', 409);
  await ImportBatch.deleteOne({ _id: id });
  return { deleted: true };
}

const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; // stop spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function batchReportCsv(id) {
  const batch = await ImportBatch.findById(id).select('results fileName');
  if (!batch) throw makeError(errorCodes.NOT_FOUND, 'No import matches that id.');
  const header = ['Row', 'Result', 'Outcome', 'Customer', 'Phone', 'Legacy ID', 'Registration', 'Message', 'Warnings'];
  const lines = [header.join(',')];
  for (const r of batch.results) {
    lines.push([r.n, r.status, r.outcome, r.customerName, r.phone, r.legacyId, r.registration, r.message, (r.warnings ?? []).join(' ')].map(csvCell).join(','));
  }
  return { name: `${batch.fileName.replace(/\.[^.]+$/, '')}-import-report.csv`, csv: lines.join('\r\n') };
}
