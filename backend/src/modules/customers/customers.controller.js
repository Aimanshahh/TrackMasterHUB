import { buildFilter, listCustomers, getCustomerById, createCustomer, updateCustomer } from './customers.service.js';
import { makeError } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

const allowedSorts = new Set(['createdAt', 'updatedAt', 'name', 'priority', 'followUp']);

async function getCustomers(req, res, next) {
  try {
    const { q, category, priority, followUp, sort = 'createdAt', direction = 'desc', page = '1', limit = '20' } = req.query;
    const owner = req.user.role === 'admin' ? undefined : req.user.id;
    const filter = await buildFilter({ q, category, priority, followUp, owner });
    const safeSort = allowedSorts.has(sort) ? sort : 'createdAt';
    const safeDirection = direction === 'asc' ? 'asc' : 'desc';
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    return res.json(await listCustomers({ filter, sort: safeSort, direction: safeDirection, page: safePage, limit: safeLimit }));
  } catch (error) { next(error); }
}

async function getCustomer(req, res, next) {
  try {
    const customer = await getCustomerById(req.params.id);
    if (req.user.role !== 'admin' && customer.owner?.id !== req.user.id) {
      return next(makeError(errorCodes.FORBIDDEN, 'You are not allowed to view this customer record.', 403));
    }
    return res.json({ data: { customer } });
  } catch (error) { next(error); }
}

async function createCustomerRecord(req, res, next) {
  try {
    const input = req.body ?? {};
    if (typeof input.name !== 'string' || input.name.trim().length < 1) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Customer name is required.'));
    }
    if (!String(input.phone ?? '').trim()) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Customer phone number is required.'));
    }
    const ownerId = req.user.role === 'admin' ? undefined : req.user.id;
    const customer = await createCustomer(input, ownerId);
    return res.status(201).json({ data: { customer } });
  } catch (error) { next(error); }
}

async function patchCustomerRecord(req, res, next) {
  try {
    const existing = await getCustomerById(req.params.id);
    if (req.user.role !== 'admin' && existing.owner?.id !== req.user.id) {
      return next(makeError(errorCodes.FORBIDDEN, 'You are not allowed to change this customer record.', 403));
    }
    const customer = await updateCustomer(req.params.id, req.body ?? {});
    return res.json({ data: { customer } });
  } catch (error) { next(error); }
}

export { getCustomers, getCustomer, createCustomerRecord, patchCustomerRecord };
