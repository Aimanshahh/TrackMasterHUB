import { ROLES, roleLabels } from '../config/constants.js';
import { errorCodes } from '../config/errorCodes.js';
import { makeError } from './errors.js';

const ROLE_ORDER = ROLES;

/** Read the signed-in user from the request. The cookie is httpOnly, so this is the only place that touches identity. */
export function resolveUser(req, res, next) {
  const token = req.cookies?.session;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'trackmaster-hub-dev-secret');
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    req.user = null;
  }

  return next();
}

/** Require an authenticated session. Unauthenticated requests get 401, not 403. */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return next(makeError(errorCodes.AUTHENTICATION_REQUIRED, 'You need to sign in before this screen will work.', 401));
  }
  return next();
}

/** Require an administrator. The URL is not a permission. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(makeError(errorCodes.FORBIDDEN, 'Only the admin account can open this screen.', 403));
  }
  return next();
}

/** Require a role at or above `role`. Admin > Manager > Operations > Salesperson. */
export function requireRole(...allowedRoles) {
  const sorted = [...allowedRoles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));

  return (req, res, next) => {
    if (!req.user || !sorted.includes(req.user.role)) {
      return next(makeError(errorCodes.FORBIDDEN, 'You are not allowed to open this screen.', 403));
    }
    return next();
  };
}

export function decorateRole(req, res, next) {
  if (req.user) {
    req.roleLabel = roleLabels[req.user.role] ?? req.user.role;
  }
  next();
}

import jwt from 'jsonwebtoken';
