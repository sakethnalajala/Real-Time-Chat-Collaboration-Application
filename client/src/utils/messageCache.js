/**
 * Immutable helpers for the React Query caches:
 *  ['conversations']        → Conversation[]
 *  ['conversation', id]     → Conversation
 *  ['messages', id]         → InfiniteData<{ messages, hasMore, nextCursor }> (pages[0] = newest)
 */
import { previewFor, sortConversations } from './conversation.js';

const mapPages = (data, fn) => (data ? { ...data, pages: data.pages.map((page, index) => fn(page, index)) } : data);

export const flattenMessages = (data) => (data ? data.pages.slice().reverse().flatMap((page) => page.messages) : []);

const sameMessage = (a, b) => a._id === b._id || (a.clientMsgId && b.clientMsgId && a.clientMsgId === b.clientMsgId);

/** Inserts or replaces a message (matched by id or client id). */
export function upsertMessage(data, message) {
  if (!data) return data;
  let replaced = false;
  const next = mapPages(data, (page) => {
    if (!page.messages.some((m) => sameMessage(m, message))) return page;
    replaced = true;
    return { ...page, messages: page.messages.map((m) => (sameMessage(m, message) ? { ...message } : m)) };
  });
  if (replaced) return next;
  return mapPages(data, (page, index) => (index === 0 ? { ...page, messages: [...page.messages, message] } : page));
}

export function patchMessage(data, match, patch) {
  return mapPages(data, (page) => {
    if (!page.messages.some(match)) return page;
    return { ...page, messages: page.messages.map((m) => (match(m) ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)) };
  });
}

export function removeMessage(data, match) {
  return mapPages(data, (page) => ({ ...page, messages: page.messages.filter((m) => !match(m)) }));
}

/** Keeps reply previews in sync when the original message is edited or deleted. */
export function syncReplyPreviews(data, original) {
  return mapPages(data, (page) => {
    if (!page.messages.some((m) => m.replyTo?._id === original._id)) return page;
    return {
      ...page,
      messages: page.messages.map((m) =>
        m.replyTo?._id === original._id
          ? {
              ...m,
              replyTo: {
                ...m.replyTo,
                isDeleted: original.isDeleted,
                content: original.isDeleted ? '' : original.content,
                attachment: original.isDeleted ? null : m.replyTo.attachment,
              },
            }
          : m
      ),
    };
  });
}

/* ----------------------------- conversations ---------------------------- */

export function upsertConversation(list, conversation) {
  if (!list) return list;
  const exists = list.some((c) => c._id === conversation._id);
  const next = exists ? list.map((c) => (c._id === conversation._id ? conversation : c)) : [conversation, ...list];
  return sortConversations(next);
}

export const updateConversationIn = (list, id, updater) =>
  list ? list.map((c) => (c._id === id ? updater(c) : c)) : list;

export function updateParticipant(conversation, userId, updater) {
  return {
    ...conversation,
    participants: conversation.participants.map((p) => (p.user._id === userId ? { ...p, ...updater(p) } : p)),
  };
}

const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

export function applyReceipt(conversation, { userId, type, at }) {
  return updateParticipant(conversation, userId, (p) =>
    type === 'read'
      ? { lastReadAt: later(p.lastReadAt, at), lastDeliveredAt: later(p.lastDeliveredAt, at) }
      : { lastDeliveredAt: later(p.lastDeliveredAt, at) }
  );
}

/** Applies a just-sent/received message to a conversation summary. */
export function applyLastMessage(conversation, message, { meId, incrementUnread }) {
  const lastMessage = {
    _id: message._id,
    sender: message.sender?._id ?? null,
    senderName: message.sender?.fullName ?? '',
    type: message.type,
    preview: previewFor(message),
    isDeleted: Boolean(message.isDeleted),
    createdAt: message.createdAt,
  };
  let next = { ...conversation, lastMessage, lastMessageAt: message.createdAt };
  if (message.sender?._id === meId) {
    next = updateParticipant(next, meId, (p) => ({
      lastReadAt: later(p.lastReadAt, message.createdAt),
      lastDeliveredAt: later(p.lastDeliveredAt, message.createdAt),
    }));
  } else if (incrementUnread) {
    next = updateParticipant(next, meId, (p) => ({ unreadCount: (p.unreadCount || 0) + 1 }));
  }
  return next;
}

export function replaceUserEverywhere(conversation, user) {
  if (!conversation.participants.some((p) => p.user._id === user._id)) return conversation;
  return {
    ...conversation,
    participants: conversation.participants.map((p) => (p.user._id === user._id ? { ...p, user: { ...p.user, ...user } } : p)),
  };
}
