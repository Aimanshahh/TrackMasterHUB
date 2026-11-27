import { requireAdmin } from '../../middleware/auth.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { createUser, getUsers, getUserById, getSalespersonPerformance, changeRole, setTarget, setPassword } from './users.service.js';
import { ASSIGNABLE_ROLES } from '../../config/constants.js';

async function getUsersList(req, res, next) {
  try {
    const { role, q: search } = req.query;
    const users = await getUsers({ role, search });
    return res.json({ data: { users } });
  } catch (error) { next(error); }
}

async function createUserAccount(req, res, next) {
  try {
    const { name, email, password, role, technicianId, phone, station } = req.body ?? {};
    if (!name || !email || !password || !role) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Name, email, password and role are required.'));
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Choose a valid non-admin role.'));
    }
    const user = await createUser({ name, email, password, role, technicianId, phone, station }, req.user);
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
    const user = await changeRole({ ...req.body, id: req.params.id }, req.user);
    return res.json({ data: { user } });
  } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
  try {
    return res.json({ data: { user: await setPassword(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function setSalespersonTarget(req, res, next) {
  try {
    return res.json({ data: { user: await setTarget(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function getSalespersonProfile(req, res, next) {
  try {
    return res.json({ data: await getSalespersonPerformance(req.params.id) });
  } catch (error) { next(error); }
}

export { resetPassword, setSalespersonTarget, createUserAccount, getUsersList, getMe, getSalespersonProfile, changeUserRole };
