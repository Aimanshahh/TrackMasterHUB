import { getSyncStatus, getVehicleProfile, listVehicles, refreshVehicleStatus } from './vehicles.service.js';

async function getVehicles(req, res, next) {
  try {
    const { q, status, page, limit } = req.query;
    return res.json(await listVehicles({ q, status, page, limit }));
  } catch (error) { next(error); }
}

async function getProfile(req, res, next) {
  try {
    return res.json(await getVehicleProfile(req.params.id));
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
