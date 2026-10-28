import { errorCodes } from '../config/errorCodes.js';

export function makeError(code, message, status = 400) {
  return {
    code,
    message,
    status,
    requestId: crypto.randomUUID(),
  };
}

/** Central error handler: every problem leaves the same JSON shape. */
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (err.code === errorCodes.VALIDATION_ERROR) {
    return res.status(status).json({ error: { code: err.code, message: err.message, requestId: err.requestId } });
  }

  if (err.status === 429) {
    return res.status(429).json({ error: { code: errorCodes.RATE_LIMITED, message: err.message, requestId: err.requestId } });
  }

  if (status >= 500) {
    console.error('[trackmaster-hub-api] ' + err.message, err);
  }

  res.status(status).json({ error: { code: err.code || errorCodes.DATABASE_ERROR, message: err.message, requestId: err.requestId || null } });
}
