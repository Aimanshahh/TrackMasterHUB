import crypto from "crypto";
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'trackmaster-hub-dev-secret';

async function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
}

async function createTokenForUser(user) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.create({
    token,
    user: user._id,
    expiresAt,
  });

  return token;
}

async function authenticate(email, password) {
  const user = await findUserByEmail(email);

  if (!user || !user.active) {
    throw makeError(errorCodes.AUTHENTICATION_FAILED, 'The email or password is not correct.');
  }

  const match = await user.comparePassword(password);

  if (!match) {
    throw makeError(errorCodes.AUTHENTICATION_FAILED, 'The email or password is not correct.');
  }

  return user;
}

async function issueSession(user) {
  const token = await createTokenForUser(user);
  const signedToken = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  return { token, signedToken };
}

async function getSessionUser(sessionToken) {
  if (!sessionToken) {
    return null;
  }

  const session = await Session.findOne({
    token: sessionToken,
    expiresAt: { $gt: new Date() },
  }).populate('user', 'id email name role active');

  if (!session) {
    return null;
  }

  await Session.pruneExpiredSessions();

  return session.user;
}

async function invalidateSession(sessionToken) {
  if (!sessionToken) return;
  await Session.deleteOne({ token: sessionToken });
}

async function createUser(input) {
  const existing = await User.findOne({ email: input.email.toLowerCase().trim() });

  if (existing) {
    throw makeError(errorCodes.CONFLICT, 'An account with this email address already exists.');
  }

  if (input.password.length < 8) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters long.');
  }

  const user = new User({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    role: input.role,
    active: input.active !== false,
    passwordHash: input.password,
  });

  await user.save();

  const { passwordHash, ...result } = user.toObject();
  return result;
}

async function listUsers({ role, activeOnly }) {
  const filter = { active: true };
  if (role) {
    filter.role = role;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  return users.map((user) => user.toApiJson());
}

async function findUserByEmailOrId(identifier) {
  if (identifier.startsWith('a') || identifier.startsWith('A')) {
    return User.findById(identifier).select('+passwordHash');
  }
  return User.findOne({ email: identifier.toLowerCase().trim() }).select('+passwordHash');
}

export {
  authenticate,
  issueSession,
  getSessionUser,
  invalidateSession,
  createUser,
  listUsers,
  findUserByEmailOrId,
};
