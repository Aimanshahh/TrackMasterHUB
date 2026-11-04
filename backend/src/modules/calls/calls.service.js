import CallLog, { CALL_STATUSES } from '../../models/CallLog.js';
import Customer from '../../models/Customer.js';
import { phoneKey, phoneRegexFor } from '../../utils/phone.js';
import { parseCallPayload } from './payload.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findCustomerId(key) {
  const regex = phoneRegexFor(key);
  if (!regex) return null;
  const matches = await Customer.find({ phone: regex }).select('_id').limit(2);
  // Two customers sharing a number is ambiguous: leave the call unmatched rather than guess.
  return matches.length === 1 ? matches[0]._id : null;
}

/** Store one delivery. Repeats of the same call id are ignored, so the provider can safely retry. */
export async function recordCall(body) {
  const mapped = parseCallPayload(body);
  if (!mapped) return { stored: false, reason: 'no call id or number in payload' };

  const key = phoneKey(mapped.calledNumber);
  const existing = await CallLog.findOne({ callId: mapped.callId }).select('_id');
  if (existing) return { stored: false, duplicate: true };

  try {
    await CallLog.create({ ...mapped, phoneKey: key, customer: await findCustomerId(key), raw: body });
  } catch (error) {
    if (error?.code === 11000) return { stored: false, duplicate: true };
    throw error;
  }
  return { stored: true };
}

export async function listCalls({ status, q, customer, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (CALL_STATUSES.includes(status)) filter.status = status;
  if (customer) filter.customer = customer;

  const term = String(q ?? '').trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ alertId: regex }, { alertType: regex }, { callId: regex }];
    if (digits.length >= 4) filter.$or.push({ calledNumber: new RegExp(escapeRegex(digits)) });
  }

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));

  const [rows, total, answered] = await Promise.all([
    CallLog.find(filter).sort({ calledAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate('customer', 'name'),
    CallLog.countDocuments(filter),
    CallLog.countDocuments({ ...filter, status: 'answered' }),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { total, answered, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
}

export async function listCallsForCustomer(customerId) {
  const rows = await CallLog.find({ customer: customerId }).sort({ calledAt: -1 }).limit(200);
  return rows.map((row) => row.toApiJson());
}
