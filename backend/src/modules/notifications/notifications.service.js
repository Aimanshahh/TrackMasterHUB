import Notification from '../../models/Notification.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

/**
 * Create an in-app notification for one user. Called by the modules that own a
 * status transition, never by the browser. A missing recipient is not an error:
 * legacy records may have no recorded owner.
 */
async function notifyUser({ userId, type, title, body, link, meta }) {
  if (!userId) return null;

  return Notification.create({
    user: userId,
    type,
    title,
    body,
    link,
    meta,
  });
}

async function listNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  const filter = { user: userId };
  if (unreadOnly) filter.readAt = null;

  const [rows, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);

  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { unread },
  };
}

async function markRead(userId, id) {
  const notification = await Notification.findOne({ _id: id, user: userId });
  if (!notification) throw makeError(errorCodes.NOT_FOUND, 'No notification matches that id.');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return notification.toApiJson();
}

async function markAllRead(userId) {
  await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
  return { ok: true };
}

export { notifyUser, listNotifications, markRead, markAllRead };
