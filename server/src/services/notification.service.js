import { Notification, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { idOf, isObjectId, pageParams, paginated, truncate } from '../utils/helpers.js';
import { PUBLIC_USER_FIELDS, serializeNotification } from '../utils/serializers.js';
import { emitToUser } from '../sockets/emitter.js';
import { logger } from '../utils/logger.js';
import { NOTIFICATION_TYPES, ROLES, USER_STATUS } from '../utils/constants.js';

export const unreadCount = (userId) => Notification.countDocuments({ recipient: userId, isRead: false });

async function pushCount(userId) {
  emitToUser(userId, 'notification:count', { unread: await unreadCount(userId) });
}

async function publish(doc) {
  await doc.populate({ path: 'actor', select: PUBLIC_USER_FIELDS });
  const recipient = idOf(doc.recipient);
  emitToUser(recipient, 'notification:new', { notification: serializeNotification(doc) });
  await pushCount(recipient);
  return doc;
}

/** Creates a single notification and pushes it in real time. Never throws (notifications are best-effort). */
export async function notify(recipientId, { type, actor = null, conversation = null, message = null, report = null, title, body = '', link = '' }) {
  try {
    const doc = await Notification.create({
      recipient: recipientId,
      type,
      actor,
      conversation,
      message,
      report,
      title: truncate(title, 160),
      body: truncate(body, 500),
      link,
    });
    return await publish(doc);
  } catch (err) {
    logger.warn('[notifications] Failed to create notification:', err.message);
    return null;
  }
}

export async function notifyMany(recipientIds, payload) {
  await Promise.all(recipientIds.map((id) => notify(id, payload)));
}

export async function notifyAdmins(payload) {
  const admins = await User.find({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE }).select('_id').lean();
  await notifyMany(admins.map((a) => a._id), payload);
}

/**
 * Message notifications are aggregated per conversation: while unread, new messages update the
 * same notification and increase its count ("3 new messages").
 */
export async function upsertMessageNotification(recipientId, { conversation, message, sender, preview }) {
  const isGroup = conversation.type === 'group';
  const firstName = sender.fullName.split(' ')[0];
  const filter = { recipient: recipientId, type: NOTIFICATION_TYPES.MESSAGE, conversation: conversation._id, isRead: false };
  const update = {
    $set: {
      actor: sender._id,
      message: message._id,
      title: truncate(isGroup ? conversation.group?.name || 'Group' : sender.fullName, 160),
      body: truncate(isGroup ? `${firstName}: ${preview}` : preview, 500),
      link: `/chats/${conversation._id}`,
    },
    $inc: { count: 1 },
  };

  const options = { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true };
  try {
    let doc;
    try {
      doc = await Notification.findOneAndUpdate(filter, update, options);
    } catch (err) {
      // Two messages raced to create the notification: the unique index rejected one; retry as an update.
      if (err.code !== 11000) throw err;
      doc = await Notification.findOneAndUpdate(filter, update, options);
    }
    await publish(doc);
  } catch (err) {
    logger.warn('[notifications] Message notification failed:', err.message);
  }
}

export async function listNotifications(userId, { page, limit, unread } = {}) {
  const params = pageParams({ page, limit }, 50);
  const filter = { recipient: userId };
  if (unread) filter.isRead = false;
  const [items, total, unreadTotal] = await Promise.all([
    Notification.find(filter)
      .sort({ updatedAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .populate({ path: 'actor', select: PUBLIC_USER_FIELDS }),
    Notification.countDocuments(filter),
    unreadCount(userId),
  ]);
  return { ...paginated(items.map(serializeNotification), total, params), unread: unreadTotal };
}

export async function markRead(userId, notificationId) {
  if (!isObjectId(notificationId)) throw AppError.notFound('Notification not found');
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: 'after' }
  ).populate({ path: 'actor', select: PUBLIC_USER_FIELDS });
  if (!doc) throw AppError.notFound('Notification not found');
  await pushCount(userId);
  return serializeNotification(doc);
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ recipient: userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  await pushCount(userId);
  return { updated: result.modifiedCount };
}

export async function markConversationRead(userId, conversationId) {
  const result = await Notification.updateMany(
    { recipient: userId, conversation: conversationId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  if (result.modifiedCount) await pushCount(userId);
}

export async function removeNotification(userId, notificationId) {
  if (!isObjectId(notificationId)) throw AppError.notFound('Notification not found');
  const result = await Notification.deleteOne({ _id: notificationId, recipient: userId });
  if (!result.deletedCount) throw AppError.notFound('Notification not found');
  await pushCount(userId);
}

export async function clearAll(userId) {
  const result = await Notification.deleteMany({ recipient: userId });
  await pushCount(userId);
  return { deleted: result.deletedCount };
}
