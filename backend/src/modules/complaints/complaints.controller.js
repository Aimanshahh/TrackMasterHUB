import { listComplaints, createComplaint, updateComplaint } from './complaints.service.js';

/** Salespeople only see tickets they logged; admin and operations see the queue. */
function scopeFor(user) {
  return user.role === 'salesperson' ? user.id : undefined;
}

async function getComplaints(req, res, next) {
  try {
    const { status, priority, q, page, limit } = req.query;
    const result = await listComplaints({ status, priority, q, page, limit, createdBy: scopeFor(req.user) });
    return res.json(result);
  } catch (error) { next(error); }
}

async function postComplaint(req, res, next) {
  try {
    const complaint = await createComplaint(req.body ?? {}, req.user);
    return res.status(201).json({ data: { complaint } });
  } catch (error) { next(error); }
}

async function patchComplaint(req, res, next) {
  try {
    const complaint = await updateComplaint(req.params.id, req.body ?? {}, req.user);
    return res.json({ data: { complaint } });
  } catch (error) { next(error); }
}

export { getComplaints, postComplaint, patchComplaint };
