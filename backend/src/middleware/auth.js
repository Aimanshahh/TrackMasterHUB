import { ROLES, roleLabels } from '../config/constants.js';
import { getSessionUser } from '../modules/auth/auth.service.js';
import { errorCodes } from '../config/errorCodes.js';
import { makeError } from './errors.js';

export async function resolveUser(req, _res, next) {
  try {
    req.user = req.sessionToken ? await getSessionUser(req.sessionToken) : null;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(makeError(errorCodes.AUTHENTICATION_REQUIRED, 'You need to sign in before this screen will work.', 401));
  return next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(makeError(errorCodes.FORBIDDEN, 'Only the admin account can open this screen.', 403));
  return next();
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role) || !ROLES.includes(req.user.role)) {
      return next(makeError(errorCodes.FORBIDDEN, 'You are not allowed to open this screen.', 403));
    }
    return next();
  };
}

export function decorateRole(req, _res, next) {
  if (req.user) req.roleLabel = roleLabels[req.user.role] ?? req.user.role;
  next();
}
