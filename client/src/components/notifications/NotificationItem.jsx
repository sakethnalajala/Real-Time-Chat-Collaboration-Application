import { motion } from 'framer-motion';
import { AlertTriangle, Flag, MessageSquare, Shield, ShieldCheck, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { formatRelative } from '../../utils/format.js';
import Avatar from '../ui/Avatar.jsx';

const TYPES = {
  message: { icon: MessageSquare, tone: 'bg-brand-500/12 text-brand-400' },
  group_added: { icon: UserPlus, tone: 'bg-emerald-500/12 text-emerald-500' },
  group_removed: { icon: UserMinus, tone: 'bg-rose-500/12 text-rose-500' },
  group_role: { icon: Shield, tone: 'bg-sky-500/12 text-sky-500' },
  report_new: { icon: Flag, tone: 'bg-amber-500/12 text-amber-500' },
  report_update: { icon: ShieldCheck, tone: 'bg-emerald-500/12 text-emerald-500' },
  account: { icon: AlertTriangle, tone: 'bg-amber-500/12 text-amber-500' },
};

export function NotificationIcon({ type, small }) {
  const meta = TYPES[type] || TYPES.message;
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-xl', meta.tone, small ? 'h-8 w-8' : 'h-10 w-10')}>
      <meta.icon className={small ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}

export default function NotificationItem({ notification, onOpen, onDelete }) {
  const n = notification;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className={cn(
        'group relative flex items-start gap-3 rounded-2xl border p-3.5 transition sm:p-4',
        n.isRead ? 'border-line bg-surface/60' : 'border-brand-500/25 bg-brand-500/[0.06]'
      )}
    >
      <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="relative">
          {n.actor ? <Avatar src={n.actor.avatarUrl} name={n.actor.fullName} size="md" /> : <NotificationIcon type={n.type} />}
          {n.actor && (
            <span className="absolute -right-1.5 -bottom-1.5 scale-75">
              <NotificationIcon type={n.type} small />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm', n.isRead ? 'font-medium text-fg' : 'font-bold text-fg')}>{n.title}</span>
            {n.count > 1 && <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-fg">{n.count} new</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{n.body}</span>
          <span className="mt-1 block text-xs text-subtle">{formatRelative(n.updatedAt)}</span>
        </span>
      </button>
      {!n.isRead && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_10px] shadow-brand-500" aria-label="Unread" />}
      <button
        type="button"
        onClick={() => onDelete(n)}
        className="rounded-lg p-1.5 text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 touch:opacity-100"
        aria-label="Delete notification"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.li>
  );
}
