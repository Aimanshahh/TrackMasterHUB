import { env } from '../config/env.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
  maxAge: env.sessionTtlDays * 24 * 60 * 60 * 1000,
};

/** Read the session cookie into req.sessionToken without exposing it to the client. */
export function parseSessionCookie(req, res, next) {
  const token = req.cookies?.session;
  if (token) {
    req.sessionToken = token;
  }
  next();
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', [
    'session=' + token +
      '; HttpOnly; SameSite=lax' +
      (env.isProduction ? '; Secure' : '') +
      '; Path=/; Max-Age=' + (env.sessionTtlDays * 24 * 60 * 60),
  ]);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', ['session=; HttpOnly; SameSite=lax; Path=/; Max-Age=0']);
}
