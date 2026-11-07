import { getSyncStatus, getVehicleProfile, listVehicles, refreshVehicleStatus } from './vehicles.service.js';
import { makeError } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';

async function getVehicles(req, res, next) {
  try {
    const { q, status, page, limit } = req.query;
    // Operations must look up a vehicle deliberately; never expose the full
    // customer vehicle register to that workspace.
    if (req.user.role === 'operations' && !String(q ?? '').trim()) {
      return res.json({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 25)),
          pages: 0,
          counts: { total: 0, active: 0, inactive: 0, unknown: 0, not_tracked: 0 },
        },
      });
    }
    return res.json(await listVehicles({ q, status, page, limit }));
  } catch (error) { next(error); }
}

async function getProfile(req, res, next) {
  try {
    if (req.user.role === 'operations' && !String(req.query.lookup ?? '').trim()) {
      return next(makeError(errorCodes.FORBIDDEN, 'Search for a vehicle before opening its details.', 403));
    }
    return res.json(await getVehicleProfile(req.params.id, req.query.lookup));
  } catch (error) { next(error); }
}

async function getStatus(req, res, next) {
  try {
    return res.json({ data: getSyncStatus() });
  } catch (error) { next(error); }
}

async function postRefresh(req, res, next) {
  try {
    return res.json({ data: await refreshVehicleStatus() });
  } catch (error) { next(error); }
}

export { getProfile, getVehicles, getStatus, postRefresh };
