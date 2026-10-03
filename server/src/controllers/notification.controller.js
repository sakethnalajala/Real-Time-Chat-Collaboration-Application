import * as notificationService from '../services/notification.service.js';
import { noContent, ok } from '../utils/respond.js';

export async function list(req, res) {
  ok(res, await notificationService.listNotifications(req.user._id, req.valid.query));
}

export async function count(req, res) {
  ok(res, { unread: await notificationService.unreadCount(req.user._id) });
}

export async function markRead(req, res) {
  ok(res, { notification: await notificationService.markRead(req.user._id, req.valid.params.id) });
}

export async function markAllRead(req, res) {
  ok(res, await notificationService.markAllRead(req.user._id));
}

export async function remove(req, res) {
  await notificationService.removeNotification(req.user._id, req.valid.params.id);
  noContent(res);
}

export async function clearAll(req, res) {
  ok(res, await notificationService.clearAll(req.user._id));
}
