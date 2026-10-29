import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getNotifications, readAllNotifications, readNotification } from './notifications.controller.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/', getNotifications);
notificationsRouter.post('/read-all', readAllNotifications);
notificationsRouter.patch('/:id/read', readNotification);
