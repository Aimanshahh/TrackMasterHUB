import crypto from 'node:crypto';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { env } from '../../config/env.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

async function findUserByEmail(email) {
  // Some existing admin documents were created before email normalization was
  // enforced. Match the exact address case-insensitively so those accounts can
  // still sign in while normalizing all newly-created accounts on save.
  const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') }).select('+passwordHash');
}

async function createTokenForUser(user) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  await Session.create({ token, user: user._id, expiresAt });
  return token;
}

async function authenticate(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !user.active || !(await user.comparePassword(password))) {
    throw makeError(errorCodes.AUTHENTICATION_FAILED, 'The email or password is not correct.', 401);
  }
  return user;
}

async function issueSession(user) {
  const token = await createTokenForUser(user);
  return { token };
}

async function getSessionUser(sessionToken) {
  if (!sessionToken) return null;
  const session = await Session.findOne({ token: sessionToken, expiresAt: { $gt: new Date() } })
    .populate('user', 'id email name role active');
  if (!session?.user?.active) return null;
  return session.user;
}

async function invalidateSession(sessionToken) {
  if (sessionToken) await Session.deleteOne({ token: sessionToken });
}

async function createUser(input) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Name must contain at least two characters.');
  }
  if (typeof input.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter a valid email address.');
  }
  if (typeof input.password !== 'string' || input.password.length < 8) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters long.');
  }
  const email = input.email.toLowerCase().trim();
  if (await User.exists({ email })) throw makeError(errorCodes.CONFLICT, 'An account with this email address already exists.', 409);

  const user = new User({ name: input.name.trim(), email, role: input.role, active: input.active !== false, passwordHash: input.password });
  await user.save();
  return user.toApiJson();
}

async function listUsers({ role, activeOnly = true } = {}) {
  const filter = {};
  if (activeOnly) filter.active = true;
  if (role) filter.role = role;
  const users = await User.find(filter).sort({ createdAt: -1 });
  return users.map((user) => user.toApiJson());
}

export { authenticate, issueSession, getSessionUser, invalidateSession, createUser, listUsers };
