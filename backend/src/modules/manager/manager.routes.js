import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  getCustomer,
  getCustomerLookup,
  getQueue,
  getSummary,
  patchBriefing,
} from './manager.controller.js';

export const managerRouter = Router();

managerRouter.use(requireAuth);

// The admin may open this desk too; nobody else can see global customer
// records, briefing data or the billing queue.
const managerDesk = requireRole('admin', 'manager');

managerRouter.get('/summary', managerDesk, getSummary);
managerRouter.get('/customers', managerDesk, getCustomerLookup);
managerRouter.get('/customers/:id', managerDesk, getCustomer);
managerRouter.patch('/customers/:id/briefing', managerDesk, patchBriefing);
managerRouter.get('/billing-queue', managerDesk, getQueue);
