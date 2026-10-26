import { randomUUID } from 'node:crypto';

/**
 * Attaches a request identifier so errors and logs can be correlated.
 * The id is echoed back in the `X-Request-Id` response header.
 */
export function requestId(req, res, next) {
  const incomingId = req.get('x-request-id');
  req.id = incomingId && incomingId.length <= 100 ? incomingId : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
