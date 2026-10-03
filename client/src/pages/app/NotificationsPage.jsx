import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import NotificationItem from '../../components/notifications/NotificationItem.jsx';
import Button from '../../components/ui/Button.jsx';
import { PageHeader, Tabs } from '../../components/ui/Controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useNotificationCount } from '../../hooks/useConversations.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { notificationService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';

export default function NotificationsPage() {
  useDocumentTitle('Notifications · Nebula Chat');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: unreadCount = 0 } = useNotificationCount();

  const query = useInfiniteQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: ({ pageParam }) => notificationService.list({ page: pageParam, limit: 20, unread: filter === 'unread' || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const open = async (notification) => {
    if (!notification.isRead) {
      notificationService.markRead(notification._id).then(refresh).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const remove = async (notification) => {
    try {
      await notificationService.remove(notification._id);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationService.markAllRead();
      await refresh();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    setBusy(true);
    try {
      await notificationService.clearAll();
      await refresh();
      setConfirmClear(false);
      toast.success('Notifications cleared');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={Bell}
        title="Notifications"
        description={unreadCount ? `${unreadCount} unread` : "You're all caught up"}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={CheckCheck} onClick={markAll} disabled={!unreadCount || busy}>
              Mark all read
            </Button>
            <Button variant="danger-ghost" size="sm" leftIcon={Trash2} onClick={() => setConfirmClear(true)} disabled={!items.length || busy}>
              Clear
            </Button>
          </div>
        }
      />

      <Tabs
        className="mt-6"
        layoutId="notification-filter"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: unreadCount },
        ]}
      />

      <div className="mt-4">
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Messages, group invites and moderation updates will show up here in real time."
          />
        ) : (
          <>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((notification) => (
                  <NotificationItem key={notification._id} notification={notification} onOpen={open} onDelete={remove} />
                ))}
              </AnimatePresence>
            </ul>
            {query.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        loading={busy}
        title="Clear all notifications?"
        description="This permanently removes every notification from your inbox."
        confirmLabel="Clear all"
      />
    </PageContainer>
  );
}
