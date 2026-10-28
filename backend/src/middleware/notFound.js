import { makeError } from './errors.js';

export function notFound(req, res, next) {
  return next(makeError('ROUTE_NOT_FOUND', 'No route matches ' + req.method + ' ' + req.originalUrl + '.', 404));
}
