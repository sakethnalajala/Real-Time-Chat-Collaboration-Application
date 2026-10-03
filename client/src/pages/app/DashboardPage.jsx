import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, MessageSquarePlus, MessagesSquare, Radio, Search, UserRoundPen, Users, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, SectionHeader } from '../../components/ui/Controls.jsx';
import { CountBadge, EmptyState, Skeleton } from '../../components/ui/Feedback.jsx';
import CreateGroupModal from '../../components/group/CreateGroupModal.jsx';
import NewChatModal, { useOpenDirectChat } from '../../components/chat/NewChatModal.jsx';
import { NotificationIcon } from '../../components/notifications/NotificationItem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConversations, useTotalUnread } from '../../hooks/useConversations.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { notificationService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { getConversationDisplay, getUnreadCount, getVisibleLastMessage } from '../../utils/conversation.js';
import { presenceStore, useStore } from '../../utils/stores.js';
import { firstName, formatListTime, formatNumber, formatRelative, pluralize } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } } };

function StatCard({ icon: Icon, label, value, hint, accent, to }) {
  const body = (
    <Card className="group relative h-full overflow-hidden p-5 transition hover:border-brand-500/30">
      <div className={cn('absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40', accent)} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-fg">{formatNumber(value)}</p>
          {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-brand-400">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  useDocumentTitle('Home · Nebula Chat');
  const { user } = useAuth();
  const meId = user._id;
  const navigate = useNavigate();
  const openDirect = useOpenDirectChat();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const { data: conversations = [], isLoading } = useConversations();
  const totalUnread = useTotalUnread();
  const presence = useStore(presenceStore, (state) => state);

  const notifications = useQuery({
    queryKey: ['notifications', 'list', 'recent'],
    queryFn: () => notificationService.list({ page: 1, limit: 5 }),
    staleTime: 30_000,
  });

  const contacts = useMemo(() => {
    const map = new Map();
    conversations.forEach((c) =>
      c.participants.forEach((p) => {
        if (p.user._id !== meId && !map.has(p.user._id)) map.set(p.user._id, p.user);
      })
    );
    return [...map.values()];
  }, [conversations, meId]);

  const onlineContacts = contacts.filter((u) => (presence[u._id] ? presence[u._id].isOnline : u.isOnline));
  const groups = conversations.filter((c) => c.type === 'group').length;
  const unreadConversations = conversations.filter((c) => getUnreadCount(c, meId) > 0).length;
  const recent = conversations.slice(0, 5);

  return (
    <PageContainer wide>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.section variants={item} className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-[#0d0a18] p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-16 h-72 w-72 animate-float rounded-full bg-brand-600/40 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-64 w-64 animate-float-slow rounded-full bg-fuchsia-600/25 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar src={user.avatarUrl} name={user.fullName} size="xl" className="hidden sm:inline-flex" />
              <div>
                <p className="text-sm font-medium text-white/60">{greeting()},</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{firstName(user.fullName)} 👋</h1>
                <p className="mt-1 text-sm text-white/60">
                  {totalUnread
                    ? `You have ${totalUnread} unread message${totalUnread > 1 ? 's' : ''} in ${unreadConversations} conversation${unreadConversations > 1 ? 's' : ''}.`
                    : "You're all caught up. Start something new?"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                leftIcon={MessagesSquare}
                onClick={() => navigate('/chats')}
                className="border-transparent bg-white text-[#1a1030] hover:border-transparent hover:bg-white/90"
              >
                Open chats
              </Button>
              <Button variant="outline" leftIcon={MessageSquarePlus} onClick={() => setNewChatOpen(true)} className="border-white/20 text-white hover:bg-white/10">
                New chat
              </Button>
            </div>
          </div>
        </motion.section>

        <motion.div variants={container} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <motion.div variants={item}>
            <StatCard icon={Bell} label="Unread messages" value={totalUnread} hint={pluralize(unreadConversations, 'conversation')} accent="bg-brand-500" to="/chats" />
          </motion.div>
          <motion.div variants={item}>
            <StatCard icon={MessagesSquare} label="Conversations" value={conversations.length} hint={`${conversations.length - groups} direct · ${groups} group${groups === 1 ? '' : 's'}`} accent="bg-indigo-500" to="/chats" />
          </motion.div>
          <motion.div variants={item}>
            <StatCard icon={UsersRound} label="Groups" value={groups} hint="Team spaces" accent="bg-fuchsia-500" />
          </motion.div>
          <motion.div variants={item}>
            <StatCard icon={Radio} label="Online contacts" value={onlineContacts.length} hint={`of ${pluralize(contacts.length, 'contact')}`} accent="bg-emerald-500" />
          </motion.div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-5">
          <motion.div variants={item} className="lg:col-span-3">
            <Card className="h-full p-5">
              <SectionHeader
                title="Recent conversations"
                description="Jump back into what matters"
                action={
                  <Button as={Link} to="/chats" variant="ghost" size="sm" rightIcon={ArrowRight}>
                    All chats
                  </Button>
                }
              />
              <div className="mt-4 space-y-1">
                {isLoading ? (
                  Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
                ) : recent.length === 0 ? (
                  <EmptyState
                    compact
                    icon={MessagesSquare}
                    title="No conversations yet"
                    description="Find people and start chatting in real time."
                    action={
                      <Button size="sm" leftIcon={Search} onClick={() => navigate('/people')}>
                        Find people
                      </Button>
                    }
                  />
                ) : (
                  recent.map((conversation) => {
                    const display = getConversationDisplay(conversation, meId);
                    const last = getVisibleLastMessage(conversation, meId);
                    const unread = getUnreadCount(conversation, meId);
                    const live = display.user ? presence[display.user._id] : null;
                    return (
                      <Link
                        key={conversation._id}
                        to={`/chats/${conversation._id}`}
                        className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-surface-2"
                      >
                        <Avatar
                          src={display.avatarUrl}
                          name={display.name}
                          isGroup={display.isGroup}
                          online={display.isGroup ? undefined : live ? live.isOnline : display.user?.isOnline}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm text-fg', unread ? 'font-bold' : 'font-semibold')}>{display.name}</p>
                          <p className="truncate text-xs text-muted">{last?.preview ?? 'No messages yet'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[11px] text-subtle">{formatListTime(last?.createdAt || conversation.createdAt)}</span>
                          <CountBadge count={unread} />
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item} className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <SectionHeader title="Online now" description={`${onlineContacts.length} of your contacts`} />
              <div className="mt-4">
                {onlineContacts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                    Nobody from your chats is online right now.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {onlineContacts.slice(0, 12).map((contact) => (
                      <button
                        key={contact._id}
                        type="button"
                        onClick={() => openDirect(contact._id).catch((err) => toast.error(getErrorMessage(err)))}
                        className="group flex w-16 flex-col items-center gap-1.5"
                        title={`Message ${contact.fullName}`}
                      >
                        <Avatar src={contact.avatarUrl} name={contact.fullName} size="lg" online className="transition group-hover:scale-105" />
                        <span className="w-full truncate text-center text-[11px] font-medium text-muted group-hover:text-fg">{firstName(contact.fullName)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Latest notifications"
                action={
                  <Button as={Link} to="/notifications" variant="ghost" size="sm" rightIcon={ArrowRight}>
                    View all
                  </Button>
                }
              />
              <div className="mt-3 space-y-1">
                {notifications.isLoading ? (
                  Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
                ) : !notifications.data?.items?.length ? (
                  <p className="py-6 text-center text-sm text-muted">No notifications yet.</p>
                ) : (
                  notifications.data.items.map((n) => (
                    <Link key={n._id} to={n.link || '/notifications'} className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                      <NotificationIcon type={n.type} small />
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm', n.isRead ? 'text-muted' : 'font-semibold text-fg')}>{n.title}</p>
                        <p className="truncate text-xs text-subtle">{n.body}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-subtle">{formatRelative(n.updatedAt)}</span>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="Quick actions" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { icon: Search, label: 'Find people', onClick: () => navigate('/people') },
                  { icon: Users, label: 'New group', onClick: () => setNewGroupOpen(true) },
                  { icon: UserRoundPen, label: 'Edit profile', onClick: () => navigate('/profile') },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-2 py-3 text-xs font-medium text-muted transition hover:-translate-y-0.5 hover:border-brand-500/30 hover:text-fg"
                  >
                    <action.icon className="h-5 w-5 text-brand-400" />
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
      <CreateGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
    </PageContainer>
  );
}
