import { env } from '../config/env.js';

/**
 * Central error handler. Never leaks stack traces or internals to clients,
 * except in development where the message is useful while building.
 */
export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error(`[${req.id}]`, error);
  }

  res.status(status).json({
    error: {
      code: error.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message:
        status >= 500 && env.isProduction
          ? 'Something went wrong while processing the request.'
          : error.message,
      requestId: req.id,
    },
  });
}
