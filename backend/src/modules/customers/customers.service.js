import Customer from '../../models/Customer.js';
import { ROLES } from '../../config/constants.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

async function buildFilter({ q, category, priority, followUp, owner }) {
  const filter = {};

  if (q) {
    const regex = new RegExp(q.trim(), 'i');
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

  if (followUp) {
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
    email: input.email.trim(),
    phone: input.phone?.trim(),
    company: input.company?.trim(),
    category: input.category,
    priority: input.priority,
    source: input.source,
    followUp: input.followUp,
    notes: input.notes?.trim(),
    owner: ownerId,
  });

  await customer.save();

  return customer.toApiJson();
}

export { listCustomers, getCustomerById, createCustomer, buildFilter };
