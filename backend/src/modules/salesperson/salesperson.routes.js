import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getMyJobs, getMySummary } from './salesperson.controller.js';

export const salespersonRouter = Router();

salespersonRouter.use(requireAuth, requireRole('salesperson'));

// The user id comes from the session, so these endpoints can only ever return
// the signed-in salesperson's own portfolio.
salespersonRouter.get('/summary', getMySummary);
salespersonRouter.get('/jobs', getMyJobs);
