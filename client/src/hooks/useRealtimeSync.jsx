import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { conversationKeys } from './useConversations.js';
import { previewFor, sortConversations } from '../utils/conversation.js';
import {
  applyLastMessage,
  applyReceipt,
  patchMessage,
  removeMessage,
  replaceUserEverywhere,
  syncReplyPreviews,
  updateConversationIn,
  updateParticipant,
  upsertConversation,
  upsertMessage,
} from '../utils/messageCache.js';
import { activeConversationStore, presenceActions, typingActions } from '../utils/stores.js';
import { playNotificationSound, showDesktopNotification } from '../utils/notify.js';
import MessageToast from '../components/notifications/MessageToast.jsx';
import { assetUrl } from '../config/env.js';

/**
 * Subscribes to every server event once and keeps the React Query caches in sync,
 * so all screens update in real time without refetching.
 */
export function useRealtimeSync() {
  const { socket } = useSocket();
  const { user, updateUser, endSession } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const meId = user?._id;
  const settingsRef = useRef(user?.settings);
  settingsRef.current = user?.settings;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!socket || !meId) return undefined;
    const qc = queryClient;
    let hasConnectedBefore = socket.connected;

    const isViewing = (id) => activeConversationStore.get() === id && document.visibilityState === 'visible';

    const setConversation = (id, updater, { resort = false } = {}) => {
      qc.setQueryData(conversationKeys.list, (list) => {
        const next = updateConversationIn(list, id, updater);
        return resort && next ? sortConversations(next) : next;
      });
      qc.setQueryData(conversationKeys.detail(id), (c) => (c ? updater(c) : c));
    };

    const handlers = {
      'message:new': ({ conversationId, message }) => {
        const mine = message.sender?._id === meId;
        const viewing = isViewing(conversationId);
        qc.setQueryData(conversationKeys.messages(conversationId), (data) => upsertMessage(data, message));

        const list = qc.getQueryData(conversationKeys.list);
        if (list && !list.some((c) => c._id === conversationId)) qc.invalidateQueries({ queryKey: conversationKeys.list });
        setConversation(
          conversationId,
          (c) => applyLastMessage(c, message, { meId, incrementUnread: !mine && !viewing && message.type !== 'system' }),
          { resort: true }
        );

        if (!mine && message.sender) {
          typingActions.set(conversationId, message.sender._id, message.sender.fullName, false);
          socket.emit('message:delivered', { conversationId, messageId: message._id });
          if (viewing) socket.emit('conversation:read', { conversationId });
        }
      },

      'message:updated': ({ conversationId, message }) => {
        qc.setQueryData(conversationKeys.messages(conversationId), (data) =>
          syncReplyPreviews(patchMessage(data, (m) => m._id === message._id, message), message)
        );
        setConversation(conversationId, (c) =>
          c.lastMessage?._id === message._id ? { ...c, lastMessage: { ...c.lastMessage, preview: previewFor(message) } } : c
        );
      },

      'message:deleted': ({ conversationId, messageId, scope, message }) => {
        if (scope === 'me') {
          qc.setQueryData(conversationKeys.messages(conversationId), (data) => removeMessage(data, (m) => m._id === messageId));
          return;
        }
        qc.setQueryData(conversationKeys.messages(conversationId), (data) =>
          syncReplyPreviews(patchMessage(data, (m) => m._id === messageId, message), message)
        );
        setConversation(conversationId, (c) =>
          c.lastMessage?._id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage, preview: 'This message was deleted', isDeleted: true } }
            : c
        );
      },

      'receipt:update': (receipt) => {
        setConversation(receipt.conversationId, (c) => {
          const next = applyReceipt(c, receipt);
          return receipt.userId === meId && receipt.type === 'read' ? updateParticipant(next, meId, () => ({ unreadCount: 0 })) : next;
        });
      },

      'typing:update': ({ conversationId, userId, name, isTyping }) => {
        if (userId !== meId) typingActions.set(conversationId, userId, name, isTyping);
      },

      'presence:snapshot': ({ online }) => presenceActions.setManyOnline(online),
      'presence:online': ({ userId }) => presenceActions.setOnline(userId, true),
      'presence:offline': ({ userId, lastSeen }) => presenceActions.setOnline(userId, false, lastSeen),

      'user:updated': ({ user: updated }) => {
        qc.setQueryData(conversationKeys.list, (list) => list?.map((c) => replaceUserEverywhere(c, updated)));
        qc.setQueriesData({ queryKey: ['conversation'] }, (c) => (c?.participants ? replaceUserEverywhere(c, updated) : c));
        qc.invalidateQueries({ queryKey: ['user'] });
        if (updated._id === meId) updateUser({ fullName: updated.fullName, username: updated.username, bio: updated.bio, avatarUrl: updated.avatarUrl });
      },

      'conversation:new': ({ conversation }) => {
        qc.setQueryData(conversationKeys.list, (list) => upsertConversation(list, conversation));
        qc.setQueryData(conversationKeys.detail(conversation._id), conversation);
      },

      'conversation:updated': ({ conversation }) => {
        qc.setQueryData(conversationKeys.list, (list) => upsertConversation(list, conversation));
        qc.setQueryData(conversationKeys.detail(conversation._id), conversation);
      },

      'conversation:removed': ({ conversationId, reason }) => {
        qc.setQueryData(conversationKeys.list, (list) => list?.filter((c) => c._id !== conversationId));
        qc.removeQueries({ queryKey: conversationKeys.detail(conversationId) });
        qc.removeQueries({ queryKey: conversationKeys.messages(conversationId) });
        if (activeConversationStore.get() === conversationId) {
          navigateRef.current('/chats', { replace: true });
          if (reason === 'removed') toast.info('You were removed from this group');
          if (reason === 'deleted') toast.info('This group was deleted by its owner');
        }
      },

      'notification:new': ({ notification }) => {
        qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
        const settings = settingsRef.current || {};
        const hidden = document.visibilityState !== 'visible';
        const open = () => notification.link && navigateRef.current(notification.link);

        if (notification.type === 'message') {
          if (isViewing(notification.conversation)) return;
          const body = settings.messagePreviews === false ? 'New message' : notification.body;
          if (settings.sound !== false) playNotificationSound();
          if (hidden && settings.desktopNotifications) {
            showDesktopNotification({
              title: notification.title,
              body,
              icon: assetUrl(notification.actor?.avatarUrl),
              tag: notification.conversation,
              onClick: open,
            });
          } else if (!hidden) {
            toast.custom((id) => <MessageToast toastId={id} notification={{ ...notification, body }} onOpen={open} />, {
              id: `conversation-${notification.conversation}`,
              duration: 5000,
            });
          }
          return;
        }

        if (settings.sound !== false) playNotificationSound();
        if (hidden && settings.desktopNotifications) {
          showDesktopNotification({ title: notification.title, body: notification.body, tag: notification._id, onClick: open });
        } else {
          toast(notification.title, {
            description: notification.body,
            action: notification.link ? { label: 'View', onClick: open } : undefined,
          });
        }
      },

      'notification:count': ({ unread }) => qc.setQueryData(['notifications', 'count'], unread),

      'account:suspended': ({ reason }) => {
        toast.error(`Your account has been suspended${reason ? `: ${reason}` : '.'}`);
        endSession();
      },

      'account:logout': ({ reason }) => {
        if (reason === 'password_reset') toast.info('Your password was reset. Please sign in again.');
        else if (reason === 'admin') toast.info('An administrator signed you out.');
        else toast.info('You were signed out on all devices.');
        endSession();
      },

      'admin:report': () => qc.invalidateQueries({ queryKey: ['admin'] }),
      'admin:presence': ({ online }) =>
        qc.setQueryData(['admin', 'stats'], (stats) => (stats ? { ...stats, totals: { ...stats.totals, onlineNow: online } } : stats)),

      // After a reconnect, refetch anything that may have changed while offline.
      connect: () => {
        if (!hasConnectedBefore) {
          hasConnectedBefore = true;
          return;
        }
        qc.invalidateQueries({ queryKey: conversationKeys.list });
        qc.invalidateQueries({ queryKey: ['conversation'] });
        qc.invalidateQueries({ queryKey: ['messages'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
  }, [socket, meId, queryClient, updateUser, endSession]);
}
