import {
  createDevice,
  createJob,
  createSim,
  createTechnician,
  getOperationsSummary,
  getStockByStation,
  getStockByTechnician,
  listDevices,
  listJobs,
  listSims,
  listTechnicians,
  updateDevice,
  updateJob,
  updateSim,
  updateTechnician,
} from './operations.service.js';

async function getSummary(req, res, next) {
  try {
    return res.json({ data: await getOperationsSummary() });
  } catch (error) { next(error); }
}

async function getStationStock(req, res, next) {
  try {
    return res.json(await getStockByStation());
  } catch (error) { next(error); }
}

async function getTechnicianStock(req, res, next) {
  try {
    return res.json(await getStockByTechnician());
  } catch (error) { next(error); }
}

/* Jobs */
async function getJobs(req, res, next) {
  try {
    const { status, priority, q, technician, page, limit } = req.query;
    return res.json(await listJobs({ status, priority, q, technician, page, limit }));
  } catch (error) { next(error); }
}

async function postJob(req, res, next) {
  try {
    const job = await createJob(req.body ?? {}, req.user);
    return res.status(201).json({ data: { job } });
  } catch (error) { next(error); }
}

async function patchJob(req, res, next) {
  try {
    const job = await updateJob(req.params.id, req.body ?? {}, req.user);
    return res.json({ data: { job } });
  } catch (error) { next(error); }
}

/* Technicians */
async function getTechnicians(req, res, next) {
  try {
    return res.json(await listTechnicians({ q: req.query.q, activeOnly: req.query.active === 'true' }));
  } catch (error) { next(error); }
}

async function postTechnician(req, res, next) {
  try {
    const technician = await createTechnician(req.body ?? {}, req.user);
    return res.status(201).json({ data: { technician } });
  } catch (error) { next(error); }
}

async function patchTechnician(req, res, next) {
  try {
    const technician = await updateTechnician(req.params.id, req.body ?? {});
    return res.json({ data: { technician } });
  } catch (error) { next(error); }
}

/* Devices */
async function getDevices(req, res, next) {
  try {
    const { status, q, page, limit } = req.query;
    return res.json(await listDevices({ status, q, page, limit }));
  } catch (error) { next(error); }
}

async function postDevice(req, res, next) {
  try {
    const device = await createDevice(req.body ?? {}, req.user);
    return res.status(201).json({ data: { device } });
  } catch (error) { next(error); }
}

async function patchDevice(req, res, next) {
  try {
    const device = await updateDevice(req.params.id, req.body ?? {});
    return res.json({ data: { device } });
  } catch (error) { next(error); }
}

/* SIMs */
async function getSims(req, res, next) {
  try {
    const { status, q, page, limit } = req.query;
    return res.json(await listSims({ status, q, page, limit }));
  } catch (error) { next(error); }
}

async function postSim(req, res, next) {
  try {
    const sim = await createSim(req.body ?? {}, req.user);
    return res.status(201).json({ data: { sim } });
  } catch (error) { next(error); }
}

async function patchSim(req, res, next) {
  try {
    const sim = await updateSim(req.params.id, req.body ?? {});
    return res.json({ data: { sim } });
  } catch (error) { next(error); }
}

export {
  getSummary,
  getStationStock,
  getTechnicianStock,
  getJobs,
  postJob,
  patchJob,
  getTechnicians,
  postTechnician,
  patchTechnician,
  getDevices,
  postDevice,
  patchDevice,
  getSims,
  postSim,
  patchSim,
};
