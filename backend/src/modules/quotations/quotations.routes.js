import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  getQuotation,
  getQuotations,
  patchQuotation,
  postDecision,
  postQuotation,
  postRevise,
  postSend,
} from './quotations.controller.js';

export const quotationsRouter = Router();

quotationsRouter.use(requireAuth);

// Quotations are written by the sales desk; the admin and manager may read and
// answer them for any customer. Ownership is enforced in the service.
const quotationDesk = requireRole('admin', 'manager', 'salesperson');

quotationsRouter.get('/', quotationDesk, getQuotations);
quotationsRouter.post('/', quotationDesk, postQuotation);
quotationsRouter.get('/:id', quotationDesk, getQuotation);
quotationsRouter.patch('/:id', quotationDesk, patchQuotation);
quotationsRouter.post('/:id/send', quotationDesk, postSend);
quotationsRouter.post('/:id/decision', quotationDesk, postDecision);
quotationsRouter.post('/:id/revise', quotationDesk, postRevise);
