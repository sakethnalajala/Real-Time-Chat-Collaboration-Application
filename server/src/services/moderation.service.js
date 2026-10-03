import { config } from '../config/env.js';
import { Message, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { isObjectId, sameId } from '../utils/helpers.js';
import { adminUser, serializeMessage } from '../utils/serializers.js';
import { NOTIFICATION_TYPES, ROLES, USER_STATUS } from '../utils/constants.js';
import { disconnectUser } from '../sockets/emitter.js';
import { audit } from './audit.service.js';
import { removeMessageForEveryone } from './messageCore.js';
import { notify } from './notification.service.js';
import { revokeAllSessions } from './token.service.js';
import { issuePasswordResetLink } from './auth.service.js';

/** The public demo admin may only act on demo accounts, so it cannot harm real users. */
export function assertDemoGuard(actor, target) {
  if (config.demo.enabled && actor.isDemo && !target.isDemo) {
    throw AppError.forbidden('The demo admin can only manage demo accounts.', 'DEMO_RESTRICTED');
  }
}

async function loadTarget(targetId) {
  if (!isObjectId(targetId)) throw AppError.notFound('User not found');
  const target = await User.findById(targetId).select('+tokenVersion');
  if (!target) throw AppError.notFound('User not found');
  return target;
}

export async function setUserStatus(req, targetId, status, reason = '') {
  const target = await loadTarget(targetId);
  if (sameId(target._id, req.user._id)) throw AppError.badRequest("You can't change your own account status");
  if (target.role === ROLES.ADMIN) throw AppError.forbidden('Administrator accounts cannot be suspended');
  assertDemoGuard(req.user, target);

  if (target.status === status) return adminUser(target);

  target.status = status;
  target.statusReason = status === USER_STATUS.SUSPENDED ? reason : '';
  target.statusChangedAt = new Date();
  if (status === USER_STATUS.SUSPENDED) target.tokenVersion += 1;
  await target.save();

  if (status === USER_STATUS.SUSPENDED) {
    await revokeAllSessions(target._id, 'admin');
    disconnectUser(target._id, 'account:suspended', { reason });
  } else {
    await notify(target._id, {
      type: NOTIFICATION_TYPES.ACCOUNT,
      actor: req.user._id,
      title: 'Your account was reactivated',
      body: 'Welcome back! You can use all features again.',
    });
  }

  await audit(req, status === USER_STATUS.SUSPENDED ? 'user.suspend' : 'user.reactivate', 'user', target._id, { reason });
  return adminUser(target);
}

export async function forceLogout(req, targetId) {
  const target = await loadTarget(targetId);
  if (target.role === ROLES.ADMIN && !sameId(target._id, req.user._id)) {
    throw AppError.forbidden('You cannot sign out another administrator');
  }
  assertDemoGuard(req.user, target);

  target.tokenVersion += 1;
  await target.save();
  await revokeAllSessions(target._id, 'admin');
  disconnectUser(target._id, 'account:logout', { reason: 'admin' });
  await audit(req, 'user.force_logout', 'user', target._id);
  return { signedOut: true };
}

/**
 * Admin-issued password reset link — the email-free way to help a user who forgot their password.
 * The link is single-use, expires after PASSWORD_RESET_TTL_MINUTES, and is shown only to the admin.
 */
export async function createPasswordResetLink(req, targetId) {
  const target = await loadTarget(targetId);
  if (sameId(target._id, req.user._id)) throw AppError.badRequest('Use "Change password" on your profile to change your own password');
  if (target.role === ROLES.ADMIN) throw AppError.forbidden('Reset links cannot be created for administrator accounts');
  if (target.isDemo && config.demo.enabled) throw AppError.forbidden('Demo accounts use fixed passwords and cannot be reset.', 'DEMO_RESTRICTED');
  if (target.status !== USER_STATUS.ACTIVE) throw AppError.badRequest('Reactivate this account before creating a reset link');
  assertDemoGuard(req.user, target);

  const { resetUrl, expiresAt } = await issuePasswordResetLink(target);
  // The token is never written to the audit log — only the fact that a link was issued.
  await audit(req, 'user.reset_link', 'user', target._id, { expiresAt });
  return { resetUrl, expiresAt, ttlMinutes: config.mail.resetTtlMinutes };
}

export async function moderateMessage(req, messageId, reason = '') {
  if (!isObjectId(messageId)) throw AppError.notFound('Message not found');
  const message = await Message.findById(messageId);
  if (!message) throw AppError.notFound('Message not found');
  if (message.isDeleted) return serializeMessage(message);

  if (message.sender) {
    const sender = await User.findById(message.sender).select('isDemo');
    if (sender) assertDemoGuard(req.user, sender);
  }

  const removed = await removeMessageForEveryone(message, { by: req.user._id, moderated: true });
  if (message.sender) {
    await notify(message.sender, {
      type: NOTIFICATION_TYPES.ACCOUNT,
      actor: req.user._id,
      conversation: message.conversation,
      title: 'A message you sent was removed',
      body: reason ? `A moderator removed your message: ${reason}` : 'A moderator removed your message for violating the community guidelines.',
    });
  }
  await audit(req, 'message.remove', 'message', message._id, { reason, conversation: String(message.conversation) });
  return serializeMessage(removed);
}
