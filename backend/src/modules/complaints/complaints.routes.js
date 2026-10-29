import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getComplaints, patchComplaint, postComplaint } from './complaints.controller.js';

export const complaintsRouter = Router();

complaintsRouter.use(requireAuth);
complaintsRouter.get('/', requireRole('admin', 'operations', 'manager', 'salesperson'), getComplaints);
complaintsRouter.post('/', requireRole('admin', 'operations', 'salesperson'), postComplaint);
complaintsRouter.patch('/:id', requireRole('admin', 'operations'), patchComplaint);
