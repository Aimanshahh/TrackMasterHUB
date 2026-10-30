import Customer from '../../models/Customer.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

async function buildFilter({ q, category, priority, followUp, owner }) {
  const filter = {};

  if (q) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { company: regex },
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (priority) {
    filter.priority = priority;
  }

  if (followUp === 'overdue') {
    filter.followUp = { $lt: new Date(), $ne: null };
  } else if (followUp === 'upcoming') {
    filter.followUp = { $gte: new Date() };
  } else if (followUp) {
    filter.followUp = followUp;
  }

  if (owner) {
    filter.owner = owner;
  }

  return filter;
}

async function listCustomers({ filter, sort, direction, page, limit }) {
  const skip = (page - 1) * limit;

  const sortObj = {};
  sortObj[sort] = direction === 'desc' ? -1 : 1;

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sortObj).skip(skip).limit(limit).populate('owner', 'id name email role'),
    Customer.countDocuments(filter),
  ]);

  return {
    data: customers.map((c) => c.toApiJson()),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getCustomerById(id) {
  const customer = await Customer.findById(id).populate('owner', 'id name email role');

  if (!customer) {
    throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');
  }

  return customer.toApiJson();
}

async function createCustomer(input, ownerId) {
  const customer = new Customer({
    name: input.name.trim(),
    email: input.email?.trim() ?? '',
    phone: input.phone?.trim(),
    company: input.company?.trim(),
    category: input.category,
    priority: input.priority,
    source: input.source,
    followUp: input.followUp || undefined,
    notes: input.notes?.trim(),
    owner: ownerId,
  });

  await customer.save();

  return customer.toApiJson();
}

/**
 * Update the fields a salesperson or admin is allowed to maintain. Ownership is
 * checked by the controller before this runs; `owner` itself is never writable
 * from the browser here.
 */
async function updateCustomer(id, input) {
  const customer = await Customer.findById(id);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.');

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw makeError(errorCodes.VALIDATION_ERROR, 'Customer name cannot be empty.');
    customer.name = name;
  }
  if (input.phone !== undefined) customer.phone = String(input.phone).trim();
  if (input.email !== undefined) customer.email = String(input.email).trim();
  if (input.company !== undefined) customer.company = String(input.company).trim();
  if (input.category !== undefined) customer.category = String(input.category).trim();
  if (input.priority !== undefined) customer.priority = input.priority;
  if (input.notes !== undefined) customer.notes = String(input.notes).trim();
  if (input.followUp !== undefined) {
    customer.followUp = input.followUp ? new Date(input.followUp) : null;
    if (customer.followUp && Number.isNaN(customer.followUp.getTime())) {
      throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid follow-up date.');
    }
  }

  await customer.save();
  const populated = await Customer.findById(customer._id).populate('owner', 'id name email role');
  return populated.toApiJson();
}

export { listCustomers, getCustomerById, createCustomer, updateCustomer, buildFilter };
