import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { getCustomerMessages, postBroadcast, postDirectMessage } from './messages.controller.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth, requireAdmin);
messagesRouter.post('/broadcast', postBroadcast);
messagesRouter.get('/customers/:customerId', getCustomerMessages);
messagesRouter.post('/customers/:customerId', postDirectMessage);
