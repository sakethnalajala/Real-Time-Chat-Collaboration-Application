import { z } from 'zod';
import { User } from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import { markDelivered, markRead } from '../../services/conversation.service.js';
import { getIO, userRoom } from '../emitter.js';
import { getMemberIds } from '../membershipCache.js';
import { presence } from '../presence.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const conversationPayload = z.object({ conversationId: objectId });
const deliveredPayload = z.object({ conversationId: objectId, messageId: objectId });
const focusPayload = z.object({ conversationId: objectId.nullable() });
const presencePayload = z.object({ userIds: z.array(objectId).max(200) });

/** Fixed-window limiter per socket and event. */
function allow(socket, key, max, windowMs) {
  const now = Date.now();
  socket.data.rate ??= {};
  const bucket = (socket.data.rate[key] ??= { count: 0, reset: now + windowMs });
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

/**
 * Wraps an event handler with payload validation, rate limiting and a uniform ack:
 * ack({ ok: true, ...result }) or ack({ ok: false, error }).
 */
const handler = (socket, event, { schema, limit = [30, 10_000] }, fn) => {
  socket.on(event, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!allow(socket, event, limit[0], limit[1])) return reply({ ok: false, error: 'RATE_LIMITED' });
    const parsed = schema.safeParse(payload ?? {});
    if (!parsed.success) return reply({ ok: false, error: 'INVALID_PAYLOAD' });
    try {
      reply({ ok: true, ...((await fn(parsed.data)) || {}) });
    } catch (err) {
      logger.debug(`[socket] ${event} failed:`, err.message);
      reply({ ok: false, error: err.code || 'ERROR', message: err.message });
    }
  });
};

export function registerChatHandlers(socket) {
  const user = socket.data.user;
  const userId = String(user._id);
  const typingIn = new Set();

  const broadcastTyping = async (conversationId, isTyping) => {
    const members = await getMemberIds(conversationId);
    if (!members.includes(userId)) throw Object.assign(new Error('Not a member'), { code: 'FORBIDDEN' });
    const others = members.filter((id) => id !== userId).map(userRoom);
    if (others.length) {
      getIO()?.to(others).emit('typing:update', {
        conversationId,
        userId,
        name: user.fullName,
        isTyping,
      });
    }
  };

  handler(socket, 'typing:start', { schema: conversationPayload, limit: [30, 10_000] }, async ({ conversationId }) => {
    typingIn.add(conversationId);
    await broadcastTyping(conversationId, true);
  });

  handler(socket, 'typing:stop', { schema: conversationPayload, limit: [30, 10_000] }, async ({ conversationId }) => {
    typingIn.delete(conversationId);
    await broadcastTyping(conversationId, false);
  });

  handler(socket, 'message:delivered', { schema: deliveredPayload, limit: [120, 10_000] }, async ({ conversationId, messageId }) => {
    await markDelivered(user._id, conversationId, messageId);
  });

  handler(socket, 'conversation:read', { schema: conversationPayload, limit: [60, 10_000] }, async ({ conversationId }) => {
    const result = await markRead(user._id, conversationId);
    return { readAt: result.readAt };
  });

  handler(socket, 'conversation:focus', { schema: focusPayload, limit: [60, 10_000] }, async ({ conversationId }) => {
    if (conversationId) {
      const members = await getMemberIds(conversationId);
      if (!members.includes(userId)) throw Object.assign(new Error('Not a member'), { code: 'FORBIDDEN' });
    }
    presence.setFocus(socket.id, userId, conversationId);
  });

  handler(socket, 'presence:query', { schema: presencePayload, limit: [30, 10_000] }, async ({ userIds }) => {
    const users = await User.find({ _id: { $in: userIds } }).select('lastSeen status').lean();
    return {
      presence: Object.fromEntries(
        users.map((u) => [
          String(u._id),
          { isOnline: u.status === 'active' && presence.isOnline(u._id), lastSeen: u.lastSeen },
        ])
      ),
    };
  });

  socket.on('disconnect', () => {
    for (const conversationId of typingIn) {
      broadcastTyping(conversationId, false).catch(() => {});
    }
    typingIn.clear();
  });
}
