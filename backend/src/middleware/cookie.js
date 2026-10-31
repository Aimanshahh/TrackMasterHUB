import { env } from '../config/env.js';

function parseCookies(req, _res, next) {
  const header = req.headers.cookie ?? '';
  req.cookies = Object.fromEntries(header.split(';').map((cookie) => {
    const separator = cookie.indexOf('=');
    if (separator < 0) return null;
    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();
    try { return [name, decodeURIComponent(value)]; } catch { return [name, value]; }
  }).filter(Boolean));
  req.sessionToken = req.cookies.session ?? null;
  next();
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax${env.isProduction ? '; Secure' : ''}; Path=/; Max-Age=${env.sessionTtlDays * 24 * 60 * 60}`);
}

function clearSessionCookie(res) {
  // Max-Age=0 plus an expiry in the past clears the cookie on every browser we
  // support, including ones that ignore Max-Age on a redirect response.
  res.setHeader(
    'Set-Cookie',
    `session=; HttpOnly; SameSite=Lax${env.isProduction ? '; Secure' : ''}; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
}

export { parseCookies, setSessionCookie, clearSessionCookie };
