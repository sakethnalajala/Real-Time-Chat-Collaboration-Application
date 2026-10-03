import { memo, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { MessageSquarePlus, MessagesSquare, SearchX, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConversations } from '../../hooks/useConversations.js';
import { getErrorMessage } from '../../services/api.js';
import {
  getConversationDisplay,
  getMessageStatus,
  getUnreadCount,
  getVisibleLastMessage,
} from '../../utils/conversation.js';
import { describeTyping, usePresence, useTypingMap } from '../../utils/stores.js';
import { firstName, formatListTime } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import Button, { IconButton } from '../ui/Button.jsx';
import { CountBadge, EmptyState, ErrorState, Skeleton } from '../ui/Feedback.jsx';
import { SearchInput } from '../ui/Input.jsx';
import { Tabs } from '../ui/Controls.jsx';
import MessageStatus from './MessageStatus.jsx';
import { TypingDots } from './TypingIndicator.jsx';

const ConversationItem = memo(function ConversationItem({ conversation, meId }) {
  const display = getConversationDisplay(conversation, meId);
  const presence = usePresence(display.user);
  const typingMap = useTypingMap(conversation._id);
  const typingNames = Object.entries(typingMap)
    .filter(([id]) => id !== meId)
    .map(([, name]) => name);
  const last = getVisibleLastMessage(conversation, meId);
  const unread = getUnreadCount(conversation, meId);
  const mine = last && last.sender === meId;
  const status = mine && !last.isDeleted && last.type !== 'system' ? getMessageStatus({ createdAt: last.createdAt }, conversation, meId) : null;

  let prefix = '';
  if (last && last.type !== 'system' && !last.isDeleted) {
    if (mine) prefix = 'You: ';
    else if (display.isGroup && last.senderName) prefix = `${firstName(last.senderName)}: `;
  }

  return (
    <motion.div layout="position" transition={{ type: 'spring', stiffness: 500, damping: 42 }}>
      <NavLink
        to={`/chats/${conversation._id}`}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
            isActive ? 'bg-brand-500/12 ring-1 ring-brand-500/25' : 'hover:bg-surface-2'
          )
        }
      >
        <Avatar src={display.avatarUrl} name={display.name} isGroup={display.isGroup} online={display.isGroup ? undefined : presence.isOnline} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('truncate text-[15px] text-fg', unread ? 'font-bold' : 'font-semibold')}>{display.name}</p>
            <span className={cn('shrink-0 text-[11px]', unread ? 'font-semibold text-accent-fg' : 'text-subtle')}>
              {formatListTime(last?.createdAt || conversation.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            {typingNames.length ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-brand-400">
                <TypingDots /> {display.isGroup ? describeTyping(typingNames) : 'typing'}…
              </span>
            ) : (
              <p className={cn('flex min-w-0 items-center gap-1 truncate text-sm', unread ? 'font-medium text-fg' : 'text-muted')}>
                {status && <MessageStatus status={status} />}
                <span className={cn('truncate', last?.isDeleted && 'italic')}>
                  {last ? `${prefix}${last.preview}` : display.isGroup ? 'Group created' : 'Say hello 👋'}
                </span>
              </p>
            )}
            <CountBadge count={unread} />
          </div>
        </div>
      </NavLink>
    </motion.div>
  );
});

function ListSkeleton() {
  return (
    <div className="space-y-1 px-2">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConversationList({ onNewChat, onNewGroup }) {
  const { user } = useAuth();
  const meId = user._id;
  const { data, isLoading, isError, error, refetch } = useConversations();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const conversations = useMemo(() => data || [], [data]);
  const unreadTotal = useMemo(() => conversations.filter((c) => getUnreadCount(c, meId) > 0).length, [conversations, meId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && !getUnreadCount(c, meId)) return false;
      if (filter === 'groups' && c.type !== 'group') return false;
      if (!needle) return true;
      if (c.type === 'group') return c.group?.name?.toLowerCase().includes(needle);
      const other = getConversationDisplay(c, meId).user;
      return other?.fullName?.toLowerCase().includes(needle) || other?.username?.toLowerCase().includes(needle);
    });
  }, [conversations, query, filter, meId]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-fg">Chats</h1>
          <div className="flex gap-1">
            <IconButton icon={Users} label="New group" onClick={onNewGroup} />
            <IconButton icon={MessageSquarePlus} label="New chat" variant="primary" onClick={onNewChat} />
          </div>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search conversations" />
        <Tabs
          layoutId="chat-filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread', count: unreadTotal },
            { value: 'groups', label: 'Groups' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <ErrorState compact message={getErrorMessage(error, 'Could not load conversations')} onRetry={refetch} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="Start a private chat or create a group to get the conversation going."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" leftIcon={MessageSquarePlus} onClick={onNewChat}>
                  New chat
                </Button>
                <Button size="sm" variant="secondary" leftIcon={Users} onClick={onNewGroup}>
                  New group
                </Button>
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title={query ? 'No matching conversations' : filter === 'unread' ? "You're all caught up" : 'No groups yet'}
            description={query ? 'Try a different name.' : filter === 'unread' ? 'No unread messages right now.' : 'Create a group to collaborate with several people.'}
          />
        ) : (
          <LayoutGroup>
            <AnimatePresence initial={false}>
              <div className="space-y-0.5">
                {filtered.map((conversation) => (
                  <ConversationItem key={conversation._id} conversation={conversation} meId={meId} />
                ))}
              </div>
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}
