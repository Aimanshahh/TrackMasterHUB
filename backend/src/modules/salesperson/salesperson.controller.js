import { getSummary, listMyJobs } from './salesperson.service.js';

async function getMySummary(req, res, next) {
  try {
    return res.json({ data: await getSummary(req.user.id) });
  } catch (error) { next(error); }
}

async function getMyJobs(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    return res.json(await listMyJobs(req.user.id, { status, page, limit }));
  } catch (error) { next(error); }
}

export { getMySummary, getMyJobs };
