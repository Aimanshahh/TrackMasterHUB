import { listMessagesForComplaint, markMessageManual, retryMessage } from '../messaging/messaging.service.js';
import Complaint from '../../models/Complaint.js';
import { makeError } from '../../middleware/errors.js';
import { errorCodes } from '../../config/errorCodes.js';
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

async function getComplaintMessages(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw makeError(errorCodes.NOT_FOUND, 'No complaint matches that id.');
    if (scopeFor(req.user) && String(complaint.createdBy) !== req.user.id) {
      throw makeError(errorCodes.FORBIDDEN, 'You are not allowed to view this complaint.', 403);
    }
    return res.json({ data: { messages: await listMessagesForComplaint(complaint._id) } });
  } catch (error) { next(error); }
}

async function postMessageRetry(req, res, next) {
  try { return res.json({ data: { message: await retryMessage(req.params.messageId) } }); } catch (error) { next(error); }
}

async function postMessageManual(req, res, next) {
  try { return res.json({ data: { message: await markMessageManual(req.params.messageId, req.body?.note) } }); } catch (error) { next(error); }
}

export { getComplaintMessages, postMessageRetry, postMessageManual, getComplaints, postComplaint, patchComplaint };
