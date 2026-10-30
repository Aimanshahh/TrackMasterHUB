import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { getApprovals, postDecision } from './approvals.controller.js';

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth, requireAdmin);

approvalsRouter.get('/', getApprovals);
approvalsRouter.post('/:id/decision', postDecision);
