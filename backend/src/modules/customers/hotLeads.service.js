import Customer from '../../models/Customer.js';
import { PACKAGE_KEYS } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

export const HOT_LEAD_STATUSES = {
  ready_for_installation: 'Ready for installation',
  vehicle_unavailable: 'Vehicle unavailable',
  rescheduled: 'Installation rescheduled',
  follow_up_required: 'Follow-up required',
  converted: 'Converted',
  lost: 'Lost',
};

const nameOf = (actor) => String(actor?.name ?? actor?.email ?? '').trim();

/** A salesperson may only touch their own customer; everyone else is scoped by the caller. */
function assertCanEdit(customer, actor) {
  if (actor?.role === 'salesperson' && customer.owner?.toString() !== actor.id) {
    throw makeError(errorCodes.FORBIDDEN, 'That customer belongs to another salesperson.', 403);
  }
}

function hotRow(customer) {
  const hot = customer.hotLead ?? {};
  return {
    id: customer._id.toString(),
    name: customer.name,
    phone: customer.phone ?? '',
    company: customer.company ?? '',
    category: customer.category ?? '',
    packageKey: hot.packageKey ?? customer.packageKey ?? null,
    status: hot.status ?? 'follow_up_required',
    statusLabel: HOT_LEAD_STATUSES[hot.status] ?? 'Follow-up required',
    reason: hot.reason ?? '',
    remarks: hot.remarks ?? '',
    expectedDate: hot.expectedDate?.toISOString?.() ?? null,
    nextFollowUp: hot.nextFollowUp?.toISOString?.() ?? null,
    followUp: customer.followUp?.toISOString?.() ?? null,
    owner: customer.owner && customer.owner.name
      ? { id: customer.owner._id.toString(), name: customer.owner.name }
      : null,
    updatedAt: hot.updatedAt?.toISOString?.() ?? null,
    updatedByName: hot.updatedByName ?? '',
  };
}

async function listHotLeads({ actor, status }) {
  const filter = { 'hotLead.active': true };
  if (actor?.role === 'salesperson') filter.owner = actor.id;
  if (status && HOT_LEAD_STATUSES[status]) filter['hotLead.status'] = status;

  const rows = await Customer.find(filter)
    .sort({ 'hotLead.nextFollowUp': 1, 'hotLead.updatedAt': -1 })
    .limit(200)
    .populate('owner', 'name');

  return {
    data: rows.map(hotRow),
    meta: {
      total: rows.length,
      statuses: Object.entries(HOT_LEAD_STATUSES).map(([key, label]) => ({ key, label })),
    },
  };
}

/**
 * Marks an existing customer as a hot lead. The customer record is never
 * duplicated: the lead lives on the same record so converting it later cannot
 * create a second customer.
 */
async function setHotLead(id, input, actor) {
  const customer = await Customer.findById(id);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');
  assertCanEdit(customer, actor);

  const status = HOT_LEAD_STATUSES[input?.status] ? input.status : 'ready_for_installation';
  if (input?.packageKey && !PACKAGE_KEYS.includes(input.packageKey)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid package for this lead.');
  }

  const parseDate = (value, label) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, `Enter a valid ${label}.`);
    return date;
  };

  customer.hotLead = {
    active: true,
    status,
    reason: String(input?.reason ?? '').trim().slice(0, 400),
    remarks: String(input?.remarks ?? '').trim().slice(0, 1000),
    expectedDate: parseDate(input?.expectedDate, 'expected installation date'),
    nextFollowUp: parseDate(input?.nextFollowUp, 'next follow-up date'),
    packageKey: input?.packageKey || customer.packageKey || undefined,
    updatedAt: new Date(),
    updatedBy: actor.id,
    updatedByName: nameOf(actor),
  };
  if (input?.nextFollowUp && !input?.keepFollowUp) customer.followUp = customer.hotLead.nextFollowUp;

  await customer.save();
  const populated = await Customer.findById(customer._id).populate('owner', 'name');
  return hotRow(populated);
}

/** Removing a lead leaves the customer untouched; only the lead flag changes. */
async function clearHotLead(id, actor, { reason = '' } = {}) {
  const customer = await Customer.findById(id);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');
  assertCanEdit(customer, actor);
  if (!customer.hotLead?.active) return { cleared: false };

  customer.hotLead = {
    ...customer.hotLead.toObject?.() ?? customer.hotLead,
    active: false,
    status: 'converted',
    remarks: String(reason ?? customer.hotLead.remarks ?? '').trim().slice(0, 1000),
    updatedAt: new Date(),
    updatedBy: actor.id,
    updatedByName: nameOf(actor),
  };
  await customer.save();
  return { cleared: true };
}

export { listHotLeads, setHotLead, clearHotLead };
