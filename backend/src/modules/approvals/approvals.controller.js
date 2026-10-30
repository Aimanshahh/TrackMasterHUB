import { decideApproval, listApprovals } from './approvals.service.js';

async function getApprovals(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    return res.json(await listApprovals({ status, page, limit }));
  } catch (error) { next(error); }
}

async function postDecision(req, res, next) {
  try {
    const result = await decideApproval(req.params.id, req.body ?? {}, req.user);
    return res.json({ data: result });
  } catch (error) { next(error); }
}

export { getApprovals, postDecision };
