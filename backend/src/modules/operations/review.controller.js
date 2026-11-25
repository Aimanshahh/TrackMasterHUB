import {
  assignMicrophone,
  createMicrophone,
  listMicrophones,
  listTestingQueue,
  microphoneTasks,
  releaseMicrophone,
  reviewInstallation,
  updateSchedule,
  updateTechnicianRates,
} from './review.service.js';

async function getReviews(req, res, next) {
  try {
    return res.json(await listTestingQueue());
  } catch (error) { next(error); }
}

async function postReview(req, res, next) {
  try {
    return res.json({ data: await reviewInstallation(req.params.id, req.body ?? {}, req.user) });
  } catch (error) { next(error); }
}

async function patchSchedule(req, res, next) {
  try {
    return res.json({ data: { job: await updateSchedule(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function getMicrophones(req, res, next) {
  try {
    return res.json(await listMicrophones());
  } catch (error) { next(error); }
}

async function postMicrophone(req, res, next) {
  try {
    return res.status(201).json({ data: { microphone: await createMicrophone(req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function postAssignMicrophone(req, res, next) {
  try {
    return res.json({ data: await assignMicrophone(req.params.id, req.body ?? {}, req.user) });
  } catch (error) { next(error); }
}

async function postReleaseMicrophone(req, res, next) {
  try {
    return res.json({ data: { microphone: await releaseMicrophone(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function getMicrophoneTasks(req, res, next) {
  try {
    return res.json(await microphoneTasks());
  } catch (error) { next(error); }
}

async function patchTechnicianRates(req, res, next) {
  try {
    return res.json({ data: { technician: await updateTechnicianRates(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

export {
  getReviews,
  postReview,
  patchSchedule,
  getMicrophones,
  postMicrophone,
  postAssignMicrophone,
  postReleaseMicrophone,
  getMicrophoneTasks,
  patchTechnicianRates,
};
