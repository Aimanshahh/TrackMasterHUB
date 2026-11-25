import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  earnings,
  engineKill,
  job,
  jobs,
  recordTest,
  selectDevice,
  stock,
  submit,
  summary,
} from './technician.controller.js';

/**
 * The technician portal. Every route is scoped to the technician record linked
 * to the signed-in login; no endpoint accepts a technician id from the client.
 */
export const technicianRouter = Router();

technicianRouter.use(requireAuth, requireRole('technician'));

technicianRouter.get('/summary', summary);
technicianRouter.get('/jobs', jobs);
technicianRouter.get('/jobs/:id', job);
technicianRouter.post('/jobs/:id/stock', selectDevice);
technicianRouter.patch('/jobs/:id/tests', recordTest);
technicianRouter.post('/jobs/:id/engine-kill-request', engineKill);
technicianRouter.post('/jobs/:id/submit', submit);
technicianRouter.get('/stock', stock);
technicianRouter.get('/earnings', earnings);
