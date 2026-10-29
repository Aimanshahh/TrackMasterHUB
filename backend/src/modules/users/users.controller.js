import { requireAdmin } from '../../middleware/auth.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { createUser, getUsers, getUserById, changeRole } from './users.service.js';

async function getUsersList(req, res, next) {
  try {
    const { role, q: search } = req.query;
    const users = await getUsers({ role, search });
    return res.json({ data: { users } });
  } catch (error) { next(error); }
}

async function createUserAccount(req, res, next) {
  try {
    const { name, email, password, role } = req.body ?? {};
    if (!name || !email || !password || !role) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Name, email, password and role are required.'));
    }
    if (!['salesperson', 'manager', 'operations'].includes(role)) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid non-admin role.'));
    }
    const user = await createUser({ name, email, password, role });
    return res.status(201).json({ data: { user } });
  } catch (error) { next(error); }
}

async function getMe(req, res, next) {
  try {
    const user = await getUserById(req.user?.id);
    if (!user) return next(makeError(errorCodes.NOT_FOUND, 'Account not found.'));
    return res.json({ data: { user: user.toApiJson() } });
  } catch (error) { next(error); }
}

async function changeUserRole(req, res, next) {
  try {
    const user = await changeRole({ ...req.body, id: req.params.id });
    return res.json({ data: { user } });
  } catch (error) { next(error); }
}

export { createUserAccount, getUsersList, getMe, changeUserRole };
