import { env } from '../../config/env.js';
import User from '../../models/User.js';
import { setSessionCookie, clearSessionCookie } from '../../middleware/cookie.js';
import { authenticate, issueSession, getSessionUser, invalidateSession, createUser, listUsers } from './auth.service.js';
import { makeError } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return next(makeError(errorCodes.VALIDATION_ERROR, 'Email and password are required.'));
    const user = await authenticate(email, password);
    // Signing in always replaces the session this browser already held. Without
    // this, testing two roles from one browser leaves the older session valid
    // and the client can be pulled back into the previous account.
    await invalidateSession(req.sessionToken);
    const { token } = await issueSession(user);
    setSessionCookie(res, token);
    return res.json({ data: { user: user.toApiJson() }, meta: { expiresInSeconds: env.sessionTtlDays * 86400 } });
  } catch (error) { next(error); }
}

async function logout(req, res) {
  await invalidateSession(req.sessionToken);
  clearSessionCookie(res);
  return res.json({ data: { signedOut: true } });
}

async function getMe(req, res, next) {
  try {
    const user = await getSessionUser(req.sessionToken);
    if (!user) return next(makeError(errorCodes.AUTHENTICATION_REQUIRED, 'You need to sign in before this screen will work.', 401));
    return res.json({ data: { user: user.toApiJson() } });
  } catch (error) { next(error); }
}

async function setupStatus(req, res) {
  try {
    const exists = (await User.countDocuments()) > 0;
    return res.json({ data: { exists, setupRequired: !exists } });
  } catch {
    return res.status(503).json({ data: { exists: false, setupRequired: false, database: 'unavailable' } });
  }
}

async function bootstrap(req, res, next) {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) return next(makeError(errorCodes.VALIDATION_ERROR, 'Name, email and password are required.'));
    if (await User.exists({})) return next(makeError(errorCodes.FORBIDDEN, 'Initial admin setup is already complete.', 403));
    const user = await createUser({ name, email, password, role: 'admin' });
    const { token } = await issueSession(await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash'));
    setSessionCookie(res, token);
    return res.status(201).json({ data: { user }, meta: { expiresInSeconds: env.sessionTtlDays * 86400 } });
  } catch (error) { next(error); }
}

async function listAllUsers(req, res, next) {
  try {
    const users = await listUsers({});
    return res.json({ data: { users } });
  } catch (error) { next(error); }
}

export { login, logout, getMe, setupStatus, bootstrap, listAllUsers };
