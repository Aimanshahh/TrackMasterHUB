import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { getUsers, getUserById, changeRole } from './users.service.js';
import { makeError, errorHandler } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

async function getUsersList(req, res, next) {
  try {
    requireAdmin(req, res, next);

    const { role, q: search } = req.query;
    const users = await getUsers({ role, search });

    return res.json({ data: { users } });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await getUserById(req.user?.id);

    if (!user) {
      return next(makeError(errorCodes.NOT_FOUND, 'Account not found.'));
    }

    return res.json({ data: { user: user.toApiJson() } });
  } catch (error) {
    next(error);
  }
}

async function changeUserRole(req, res, next) {
  try {
    requireAdmin(req, res, next);

    const input = req.body || {};
    const result = await changeRole(input);

    return res.json({ data: { user: result } });
  } catch (error) {
    next(error);
  }
}

export { getUsersList, getMe, changeUserRole };
