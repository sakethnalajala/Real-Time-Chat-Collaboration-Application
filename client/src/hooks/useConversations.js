import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationService, notificationService } from '../services/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getUnreadCount } from '../utils/conversation.js';

export const conversationKeys = {
  list: ['conversations'],
  detail: (id) => ['conversation', id],
  messages: (id) => ['messages', id],
};

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list,
    queryFn: async () => (await conversationService.list()).conversations,
    staleTime: 60_000,
  });
}

/** A single conversation, seeded from the list cache for instant navigation. */
export function useConversation(id) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: async () => (await conversationService.get(id)).conversation,
    enabled: Boolean(id),
    initialData: () => queryClient.getQueryData(conversationKeys.list)?.find((c) => c._id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(conversationKeys.list)?.dataUpdatedAt,
    staleTime: 30_000,
    retry: (count, error) => error?.response?.status !== 404 && count < 2,
  });
}

/** Total unread messages across all conversations. */
export function useTotalUnread() {
  const { user } = useAuth();
  const { data } = useConversations();
  return useMemo(() => (data || []).reduce((sum, c) => sum + getUnreadCount(c, user?._id), 0), [data, user?._id]);
}

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => (await notificationService.unreadCount()).unread,
    staleTime: 60_000,
  });
}
