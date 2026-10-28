import express from 'express';
import { env } from '../../config/env.js';
import User from '../../models/User.js';
import { requireAdmin } from '../../middleware/auth.js';
import { setSessionCookie, clearSessionCookie } from '../../middleware/cookie.js';
import { authenticate, issueSession, getSessionUser, invalidateSession, createUser, listUsers } from './auth.service.js';
import { makeError, errorHandler } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Email and password are required.'));
    }

    const user = await authenticate(email, password);
    const { token, signedToken } = await issueSession(user);

    setSessionCookie(res, token);

    return sendJson(res, 200, {
      data: {
        user: user.toApiJson(),
        token: signedToken,
        role: user.role,
        roleLabel: 'Admin',
      },
      meta: {
        expiresInSeconds: env.sessionTtlDays * 24 * 60 * 60,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  const token = req.sessionToken;
  await invalidateSession(token);

  clearSessionCookie(res);

  return sendJson(res, 204, null);
}

async function getMe(req, res, next) {
  try {
    const user = await getSessionUser(req.sessionToken);

    if (!user) {
      return next(makeError(errorCodes.AUTHENTICATION_REQUIRED, 'You need to sign in before this screen will work.', 401));
    }

    return sendJson(res, 200, { data: { user: user.toApiJson() } });
  } catch (error) {
    next(error);
  }
}

async function setupStatus(req, res) {
  try {
    const count = await User.countDocuments();
    return sendJson(res, 200, { data: { exists: count > 0 } });
  } catch (error) {
    return sendJson(res, 503, { data: { exists: false, database: 'unavailable' } });
  }
}

async function bootstrap(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return next(makeError(errorCodes.VALIDATION_ERROR, 'Name, email and password are required.'));
    }

    const user = await createUser({ name, email, password, role: 'admin' });

    const { token, signedToken } = await issueSession(user);

    setSessionCookie(res, token);

    return sendJson(res, 200, {
      data: {
        user: user.toApiJson(),
        token: signedToken,
      },
      meta: {
        expiresInSeconds: env.sessionTtlDays * 24 * 60 * 60,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function listAllUsers(req, res, next) {
  try {
    requireAdmin(req, res, next);

    const users = await listUsers({});

    return sendJson(res, 200, { data: { users } });
  } catch (error) {
    next(error);
  }
}

export {
  login,
  logout,
  getMe,
  setupStatus,
  bootstrap,
  listAllUsers,
};
