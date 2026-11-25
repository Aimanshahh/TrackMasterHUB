import Technician from '../../models/Technician.js';
import TechnicianEarning from '../../models/TechnicianEarning.js';
import TechnicianPayment from '../../models/TechnicianPayment.js';
import { PAYMENT_METHODS } from '../../models/TechnicianPayment.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

const round = (value) => Math.round(Number(value ?? 0) * 100) / 100;
const nameOf = (actor) => String(actor?.name ?? actor?.email ?? '').trim();

/**
 * The technician payment ledger. Totals are always derived from the earning and
 * payment records; nothing is stored twice, so a balance cannot drift from the
 * transactions behind it.
 */
async function totalsFor(technicianIds) {
  const [earnings, payments] = await Promise.all([
    TechnicianEarning.aggregate([
      { $match: { technician: { $in: technicianIds }, reversed: { $ne: true } } },
      { $group: { _id: { technician: '$technician', type: '$type' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    TechnicianPayment.aggregate([
      { $match: { technician: { $in: technicianIds } } },
      { $group: { _id: '$technician', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const map = new Map(technicianIds.map((id) => [id.toString(), {
    earned: 0, paid: 0, installations: 0, normalCount: 0, redoCount: 0,
    normalAmount: 0, redoAmount: 0, payments: 0,
  }]));

  for (const row of earnings) {
    const key = row._id.technician.toString();
    const entry = map.get(key);
    if (!entry) continue;
    entry.earned += row.amount;
    entry.installations += row.count;
    if (row._id.type === 'redo') {
      entry.redoCount += row.count;
      entry.redoAmount += row.amount;
    } else {
      entry.normalCount += row.count;
      entry.normalAmount += row.amount;
    }
  }

  for (const row of payments) {
    const entry = map.get(row._id.toString());
    if (!entry) continue;
    entry.paid += row.amount;
    entry.payments += row.count;
  }

  for (const entry of map.values()) {
    entry.earned = round(entry.earned);
    entry.paid = round(entry.paid);
    entry.balance = round(entry.earned - entry.paid);
  }

  return map;
}

async function listAccounts() {
  const technicians = await Technician.find().sort({ active: -1, name: 1 });
  const totals = await totalsFor(technicians.map((technician) => technician._id));

  return {
    data: technicians.map((technician) => ({
      technician: technician.toApiJson(),
      totals: totals.get(technician._id.toString()),
    })),
    meta: {
      technicians: technicians.length,
      outstanding: round([...totals.values()].reduce((sum, entry) => sum + Math.max(0, entry.balance), 0)),
      paid: round([...totals.values()].reduce((sum, entry) => sum + entry.paid, 0)),
      earned: round([...totals.values()].reduce((sum, entry) => sum + entry.earned, 0)),
    },
  };
}

async function getAccount(id) {
  const technician = await Technician.findById(id);
  if (!technician) throw makeError(errorCodes.NOT_FOUND, 'No technician matches that id.');

  const [earnings, payments, totals] = await Promise.all([
    TechnicianEarning.find({ technician: id }).sort({ earnedAt: -1, createdAt: -1 }).limit(200),
    TechnicianPayment.find({ technician: id }).sort({ paidAt: -1 }).limit(200),
    totalsFor([technician._id]),
  ]);

  return {
    technician: technician.toApiJson(),
    totals: totals.get(technician._id.toString()),
    earnings: earnings.map((row) => row.toApiJson()),
    payments: payments.map((row) => row.toApiJson()),
    methods: PAYMENT_METHODS,
  };
}

async function recordPayment(id, input, actor) {
  const technician = await Technician.findById(id);
  if (!technician) throw makeError(errorCodes.NOT_FOUND, 'No technician matches that id.');

  const amount = round(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the amount paid as a number greater than zero.');
  }

  const totals = (await totalsFor([technician._id])).get(technician._id.toString());
  const balance = round(totals.earned - totals.paid);
  if (amount > balance) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      `This payment is more than the outstanding balance of PKR ${balance.toLocaleString()}. Record the amount actually owed.`,
    );
  }

  const paidAt = input?.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid payment date.');
  if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw makeError(errorCodes.VALIDATION_ERROR, 'The payment date cannot be in the future.');

  const method = PAYMENT_METHODS.includes(input?.method) ? input.method : 'cash';

  const payment = await TechnicianPayment.create({
    technician: technician._id,
    amount,
    paidAt,
    method,
    referenceNumber: String(input?.referenceNumber ?? '').trim().slice(0, 80),
    remarks: String(input?.remarks ?? '').trim().slice(0, 500),
    recordedBy: actor.id,
    recordedByName: nameOf(actor),
  });

  return { payment: payment.toApiJson(), account: await getAccount(id) };
}

/** A reversed earning stays on record with its reason; it is never deleted. */
async function reverseEarning(earningId, input, actor) {
  const earning = await TechnicianEarning.findById(earningId);
  if (!earning) throw makeError(errorCodes.NOT_FOUND, 'No earning matches that id.');
  if (earning.reversed) throw makeError(errorCodes.CONFLICT, 'That earning is already reversed.', 409);

  const note = String(input?.note ?? '').trim().slice(0, 500);
  if (!note) throw makeError(errorCodes.VALIDATION_ERROR, 'Record why this earning is being reversed.');

  earning.reversed = true;
  earning.reversedAt = new Date();
  earning.reversalNote = `${note}${actor?.name ? ` (${nameOf(actor)})` : ''}`;
  await earning.save();

  return { earning: earning.toApiJson(), account: await getAccount(earning.technician) };
}

export { listAccounts, getAccount, recordPayment, reverseEarning };
