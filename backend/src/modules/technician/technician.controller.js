import {
  getEarnings,
  getJob,
  getStock,
  getSummary,
  listJobs,
  markEngineKillUnsupported,
  requestEngineKillTest,
  runPortalCheck,
  saveTest,
  selectStock,
  submitForReview,
} from './technician.service.js';

async function summary(req, res, next) {
  try {
    return res.json({ data: await getSummary(req.user) });
  } catch (error) { next(error); }
}

async function jobs(req, res, next) {
  try {
    return res.json(await listJobs(req.user, req.query));
  } catch (error) { next(error); }
}

async function job(req, res, next) {
  try {
    return res.json({ data: await getJob(req.user, req.params.id) });
  } catch (error) { next(error); }
}

async function selectDevice(req, res, next) {
  try {
    return res.json({ data: await selectStock(req.user, req.params.id, req.body ?? {}) });
  } catch (error) { next(error); }
}

async function recordTest(req, res, next) {
  try {
    return res.json({ data: await saveTest(req.user, req.params.id, req.body ?? {}) });
  } catch (error) { next(error); }
}

async function engineKill(req, res, next) {
  try {
    return res.json({ data: await requestEngineKillTest(req.user, req.params.id, req.body ?? {}) });
  } catch (error) { next(error); }
}

async function portalCheck(req, res, next) {
  try {
    return res.json({ data: await runPortalCheck(req.user, req.params.id) });
  } catch (error) { next(error); }
}

async function engineKillUnsupported(req, res, next) {
  try {
    return res.json({ data: await markEngineKillUnsupported(req.user, req.params.id, req.body ?? {}) });
  } catch (error) { next(error); }
}

async function submit(req, res, next) {
  try {
    return res.json({ data: await submitForReview(req.user, req.params.id) });
  } catch (error) { next(error); }
}

async function stock(req, res, next) {
  try {
    return res.json({ data: await getStock(req.user) });
  } catch (error) { next(error); }
}

async function earnings(req, res, next) {
  try {
    return res.json({ data: await getEarnings(req.user) });
  } catch (error) { next(error); }
}

import { confirmRemoval, listInstallations, listRemovals, searchInstalledVehicles } from './removal.service.js';

async function removalVehicles(req, res, next) {
  try { return res.json({ data: await searchInstalledVehicles(req.user, req.query.q) }); } catch (error) { next(error); }
}
async function removalConfirm(req, res, next) {
  try { return res.status(201).json({ data: await confirmRemoval(req.user, req.body ?? {}) }); } catch (error) { next(error); }
}
async function removalList(req, res, next) {
  try { return res.json({ data: await listRemovals(req.user) }); } catch (error) { next(error); }
}
async function installationList(req, res, next) {
  try { return res.json({ data: await listInstallations(req.user) }); } catch (error) { next(error); }
}

export { removalVehicles, removalConfirm, removalList, installationList, summary, jobs, job, selectDevice, recordTest, engineKill, portalCheck, engineKillUnsupported, submit, stock, earnings };
