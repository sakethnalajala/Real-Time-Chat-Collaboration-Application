import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { conversationService, messageService } from '../services/index.js';
import { getErrorMessage } from '../services/api.js';
import { conversationKeys } from './useConversations.js';
import { useDocumentVisible } from './useUtils.js';
import { previewFor, sortConversations } from '../utils/conversation.js';
import {
  applyLastMessage,
  patchMessage,
  removeMessage,
  syncReplyPreviews,
  updateConversationIn,
  updateParticipant,
  upsertMessage,
} from '../utils/messageCache.js';
import { activeConversationStore } from '../utils/stores.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const makeClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Original payloads of unsent messages, kept so "Retry" can resend files. */
const unsent = new Map();

const emptyMessages = () => ({ pages: [{ messages: [], hasMore: false, nextCursor: null }], pageParams: [undefined] });

function revokeLocalUrls(message) {
  message?.attachments?.forEach((a) => a.local && setTimeout(() => URL.revokeObjectURL(a.url), 4000));
}

/** Optimistic sending with upload progress, idempotent retry and discard. */
export function useSendMessage(conversationId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = conversationKeys.messages(conversationId);

  const updateSummaries = useCallback(
    (message) => {
      const apply = (c) => applyLastMessage(c, message, { meId: user._id });
      queryClient.setQueryData(conversationKeys.list, (list) => {
        if (!list) return list;
        if (!list.some((c) => c._id === conversationId)) {
          queryClient.invalidateQueries({ queryKey: conversationKeys.list });
          return list;
        }
        return sortConversations(updateConversationIn(list, conversationId, apply));
      });
      queryClient.setQueryData(conversationKeys.detail(conversationId), (c) => (c ? apply(c) : c));
    },
    [queryClient, conversationId, user._id]
  );

  const send = useCallback(
    async ({ content = '', files = [], replyTo = null }, reuseClientId) => {
      const clientMsgId = reuseClientId || makeClientId();
      const attachments = files.map((file, index) => ({
        _id: `${clientMsgId}-${index}`,
        kind: IMAGE_TYPES.includes(file.type) ? 'image' : 'file',
        url: URL.createObjectURL(file),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        local: true,
      }));

      const optimistic = {
        _id: `tmp-${clientMsgId}`,
        clientMsgId,
        pending: true,
        failed: false,
        conversation: conversationId,
        sender: { _id: user._id, fullName: user.fullName, username: user.username, avatarUrl: user.avatarUrl },
        type: attachments.length ? (attachments.every((a) => a.kind === 'image') ? 'image' : 'file') : 'text',
        content,
        attachments,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              sender: replyTo.sender ? { _id: replyTo.sender._id, fullName: replyTo.sender.fullName } : null,
              type: replyTo.type,
              content: replyTo.content,
              isDeleted: replyTo.isDeleted,
              attachment: replyTo.attachments?.[0] || null,
            }
          : null,
        createdAt: new Date().toISOString(),
        progress: files.length ? 0 : undefined,
      };

      unsent.set(clientMsgId, { content, files, replyTo });
      queryClient.setQueryData(key, (data) => upsertMessage(data ?? emptyMessages(), optimistic));

      try {
        const { message } = await conversationService.sendMessage(
          conversationId,
          { content, replyTo: replyTo?._id, clientMsgId, files },
          (progress) => queryClient.setQueryData(key, (data) => patchMessage(data, (m) => m.clientMsgId === clientMsgId && m.pending, { progress }))
        );
        unsent.delete(clientMsgId);
        queryClient.setQueryData(key, (data) => upsertMessage(data, message));
        updateSummaries(message);
        revokeLocalUrls(optimistic);
        return message;
      } catch (error) {
        const reason = getErrorMessage(error, 'Message not sent');
        queryClient.setQueryData(key, (data) =>
          patchMessage(data, (m) => m.clientMsgId === clientMsgId, { pending: false, failed: true, error: reason })
        );
        toast.error(reason);
        return null;
      }
    },
    [queryClient, key, conversationId, user, updateSummaries]
  );

  const retry = useCallback(
    (message) => {
      const original = unsent.get(message.clientMsgId) || { content: message.content, files: [], replyTo: message.replyTo };
      revokeLocalUrls(message);
      return send(original, message.clientMsgId);
    },
    [send]
  );

  const discard = useCallback(
    (message) => {
      unsent.delete(message.clientMsgId);
      revokeLocalUrls(message);
      queryClient.setQueryData(key, (data) => removeMessage(data, (m) => m.clientMsgId === message.clientMsgId));
    },
    [queryClient, key]
  );

  return { send, retry, discard };
}

/** Edit / delete with immediate cache updates (the socket echo is idempotent). */
export function useMessageActions(conversationId) {
  const queryClient = useQueryClient();
  const key = conversationKeys.messages(conversationId);

  const setSummaryPreview = useCallback(
    (message, preview, extra = {}) => {
      const update = (c) => (c.lastMessage?._id === message._id ? { ...c, lastMessage: { ...c.lastMessage, preview, ...extra } } : c);
      queryClient.setQueryData(conversationKeys.list, (list) => updateConversationIn(list, conversationId, update));
      queryClient.setQueryData(conversationKeys.detail(conversationId), (c) => (c ? update(c) : c));
    },
    [queryClient, conversationId]
  );

  const edit = useCallback(
    async (message, content) => {
      const { message: updated } = await messageService.edit(message._id, content);
      queryClient.setQueryData(key, (data) => syncReplyPreviews(patchMessage(data, (m) => m._id === updated._id, updated), updated));
      setSummaryPreview(updated, previewFor(updated));
      return updated;
    },
    [queryClient, key, setSummaryPreview]
  );

  const remove = useCallback(
    async (message, scope) => {
      const result = await messageService.remove(message._id, scope);
      if (scope === 'me') {
        queryClient.setQueryData(key, (data) => removeMessage(data, (m) => m._id === message._id));
      } else {
        queryClient.setQueryData(key, (data) => syncReplyPreviews(patchMessage(data, (m) => m._id === message._id, result.message), result.message));
        setSummaryPreview(message, 'This message was deleted', { isDeleted: true });
      }
      return result;
    },
    [queryClient, key, setSummaryPreview]
  );

  return { edit, remove };
}

/** Marks the open conversation as read (socket when connected, REST otherwise). */
export function useMarkRead(conversationId) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();

  return useCallback(() => {
    const clear = (c) => updateParticipant(c, user._id, () => ({ unreadCount: 0 }));
    queryClient.setQueryData(conversationKeys.list, (list) => updateConversationIn(list, conversationId, clear));
    queryClient.setQueryData(conversationKeys.detail(conversationId), (c) => (c ? clear(c) : c));
    if (socket?.connected) socket.emit('conversation:read', { conversationId });
    else conversationService.markRead(conversationId).catch(() => {});
  }, [queryClient, socket, conversationId, user._id]);
}

/** Emits typing start/stop with throttling and auto-stop after a pause. */
export function useTypingEmitter(conversationId) {
  const { socket } = useSocket();
  const state = useRef({ typing: false, lastSent: 0, timer: null });

  const stop = useCallback(() => {
    const s = state.current;
    clearTimeout(s.timer);
    if (s.typing) {
      socket?.emit('typing:stop', { conversationId });
      s.typing = false;
    }
  }, [socket, conversationId]);

  const onType = useCallback(() => {
    const s = state.current;
    const now = Date.now();
    if (!s.typing || now - s.lastSent > 4000) {
      socket?.emit('typing:start', { conversationId });
      s.typing = true;
      s.lastSent = now;
    }
    clearTimeout(s.timer);
    s.timer = setTimeout(stop, 2500);
  }, [socket, conversationId, stop]);

  useEffect(() => stop, [stop]);
  return { onType, stop };
}

/** Tells the server which conversation is on screen (suppresses notifications for it). */
export function useConversationFocus(conversationId) {
  const { socket, status } = useSocket();
  const visible = useDocumentVisible();

  useEffect(() => {
    activeConversationStore.set(conversationId);
    return () => {
      if (activeConversationStore.get() === conversationId) activeConversationStore.set(null);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!socket || status !== 'connected') return undefined;
    socket.emit('conversation:focus', { conversationId: visible ? conversationId : null });
    return () => socket.emit('conversation:focus', { conversationId: null });
  }, [socket, status, conversationId, visible]);

  return visible;
}
