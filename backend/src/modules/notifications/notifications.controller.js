import { listNotifications, markAllRead, markRead } from './notifications.service.js';

async function getNotifications(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const unreadOnly = req.query.unread === 'true';
    return res.json(await listNotifications(req.user.id, { unreadOnly, limit }));
  } catch (error) { next(error); }
}

async function readNotification(req, res, next) {
  try {
    const notification = await markRead(req.user.id, req.params.id);
    return res.json({ data: { notification } });
  } catch (error) { next(error); }
}

async function readAllNotifications(req, res, next) {
  try {
    return res.json({ data: await markAllRead(req.user.id) });
  } catch (error) { next(error); }
}

export { getNotifications, readNotification, readAllNotifications };
