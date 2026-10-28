import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listCustomers, getCustomerById, createCustomer } from './customers.service.js';
import { makeError, errorHandler } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

async function getCustomers(req, res, next) {
  try {
    const { q, category, priority, followUp, sort = 'createdAt', direction = 'desc', page = '1', limit = '20' } = req.query;

    const filter = await buildFilter({
      q,
      category,
      priority,
      followUp,
      owner: req.user?.role === 'admin' ? undefined : req.user?.id,
    });

    const customers = await listCustomers({
      filter,
      sort,
      direction,
      page: Number(page),
      limit: Number(limit),
    });

    return res.json(customers);
  } catch (error) {
    next(error);
  }
}

async function getCustomer(req, res, next) {
  try {
    const customer = await getCustomerById(req.params.id);

    if (req.user?.role !== 'admin' && customer.owner?.toString() !== req.user?.id) {
      return next(makeError(errorCodes.FORBIDDEN, 'You are not allowed to view this customer record.'));
    }

    return res.json({ data: { customer } });
  } catch (error) {
    next(error);
  }
}

async function createCustomerRecord(req, res, next) {
  try {
    const user = req.user;
    const input = req.body || {};

    if (!input.name || !input.email) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Name and email are required.'));
    }

    const ownerId = user.role === 'admin' ? undefined : user.id;

    const customer = await createCustomer(input, ownerId);

    return res.status(201).json({ data: { customer } });
  } catch (error) {
    next(error);
  }
}

export { getCustomers, getCustomer, createCustomerRecord };
