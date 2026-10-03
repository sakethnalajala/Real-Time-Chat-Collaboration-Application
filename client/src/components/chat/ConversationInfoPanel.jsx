import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Crown,
  EllipsisVertical,
  Eraser,
  Flag,
  LogOut,
  Pencil,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { conversationService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { conversationKeys } from '../../hooks/useConversations.js';
import { ROLE_LABELS, getConversationDisplay, getMyState } from '../../utils/conversation.js';
import { upsertConversation } from '../../utils/messageCache.js';
import { usePresence } from '../../utils/stores.js';
import { formatDate, formatLastSeen } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import Button from '../ui/Button.jsx';
import { Badge } from '../ui/Feedback.jsx';
import { Menu } from '../ui/Menu.jsx';

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 };

function MemberRow({ participant, meId, myRole, onChangeRole, onRemove }) {
  const navigate = useNavigate();
  const { user, role } = participant;
  const presence = usePresence(user);
  const isMe = user._id === meId;
  const canPromote = myRole === 'owner' && !isMe && role !== 'owner';
  const canRemove = !isMe && role !== 'owner' && (myRole === 'owner' || (myRole === 'admin' && role === 'member'));

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
      <button type="button" onClick={() => navigate(`/users/${user._id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar src={user.avatarUrl} name={user.fullName} size="sm" online={presence.isOnline} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-fg">
            {user.fullName} {isMe && <span className="text-subtle">(You)</span>}
          </span>
          <span className="block truncate text-xs text-subtle">{presence.isOnline ? 'Online' : formatLastSeen(presence.lastSeen)}</span>
        </span>
      </button>
      {role !== 'member' && (
        <Badge tone={role === 'owner' ? 'warning' : 'brand'}>
          {role === 'owner' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
          {ROLE_LABELS[role]}
        </Badge>
      )}
      {(canPromote || canRemove) && (
        <Menu
          trigger={
            <button type="button" className="rounded-lg p-1.5 text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-fg touch:opacity-100" aria-label="Member actions">
              <EllipsisVertical className="h-4 w-4" />
            </button>
          }
          items={[
            { label: 'Make admin', icon: Shield, hidden: !canPromote || role === 'admin', onClick: () => onChangeRole(user, 'admin') },
            { label: 'Remove admin role', icon: ShieldOff, hidden: !canPromote || role !== 'admin', onClick: () => onChangeRole(user, 'member') },
            { label: 'Remove from group', icon: UserMinus, danger: true, hidden: !canRemove, onClick: () => onRemove(user) },
          ]}
        />
      )}
    </div>
  );
}

function GroupInfo({ conversation, meId, actions }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const myRole = getMyState(conversation, meId)?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const members = [...conversation.participants].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.fullName.localeCompare(b.user.fullName)
  );

  const store = (next) => {
    queryClient.setQueryData(conversationKeys.detail(next._id), next);
    queryClient.setQueryData(conversationKeys.list, (list) => (list ? upsertConversation(list, next) : list));
  };

  const changeRole = async (user, role) => {
    setBusy(true);
    try {
      const { conversation: next } = await conversationService.changeRole(conversation._id, user._id, role);
      store(next);
      toast.success(role === 'admin' ? `${user.fullName} is now an admin` : `${user.fullName} is no longer an admin`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (user) => {
    setBusy(true);
    try {
      const { conversation: next } = await conversationService.removeMember(conversation._id, user._id);
      store(next);
      toast.success(`${user.fullName} was removed from the group`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center px-5 pt-2 pb-5 text-center">
        <Avatar src={conversation.group.avatarUrl} name={conversation.group.name} size="2xl" rounded="rounded-3xl" isGroup />
        <h3 className="mt-4 text-lg font-bold text-fg">{conversation.group.name}</h3>
        <p className="text-sm text-muted">
          Group · {conversation.participants.length} members
        </p>
        {conversation.group.description && <p className="mt-3 text-sm leading-relaxed text-muted">{conversation.group.description}</p>}
        <p className="mt-2 text-xs text-subtle">Created {formatDate(conversation.createdAt)}</p>
        {isAdmin && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" leftIcon={Pencil} onClick={actions.onEditGroup}>
              Edit
            </Button>
            <Button size="sm" variant="secondary" leftIcon={UserPlus} onClick={actions.onAddMembers}>
              Add members
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold tracking-wider text-subtle uppercase">Members</p>
        <div className={cn('space-y-0.5', busy && 'pointer-events-none opacity-60')}>
          {members.map((participant) => (
            <MemberRow key={participant.user._id} participant={participant} meId={meId} myRole={myRole} onChangeRole={changeRole} onRemove={remove} />
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t border-line px-3 py-4">
        <Button variant="ghost" className="w-full justify-start" leftIcon={Flag} onClick={actions.onReport}>
          Report group
        </Button>
        <Button variant="danger-ghost" className="w-full justify-start" leftIcon={LogOut} onClick={actions.onLeave}>
          Leave group
        </Button>
        {myRole === 'owner' && (
          <Button variant="danger-ghost" className="w-full justify-start" leftIcon={Trash2} onClick={actions.onDelete}>
            Delete group for everyone
          </Button>
        )}
      </div>
    </>
  );
}

function DirectInfo({ conversation, meId, actions }) {
  const { user } = getConversationDisplay(conversation, meId);
  const presence = usePresence(user);
  if (!user) return null;
  return (
    <>
      <div className="flex flex-col items-center px-5 pt-2 pb-5 text-center">
        <Avatar src={user.avatarUrl} name={user.fullName} size="2xl" online={presence.isOnline} />
        <h3 className="mt-4 text-lg font-bold text-fg">{user.fullName}</h3>
        <p className="text-sm text-subtle">@{user.username}</p>
        <p className={cn('mt-1 text-xs font-medium', presence.isOnline ? 'text-emerald-500' : 'text-subtle')}>
          {presence.isOnline ? 'Online now' : formatLastSeen(presence.lastSeen)}
        </p>
        {user.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{user.bio}</p>}
        <Button as={Link} to={`/users/${user._id}`} size="sm" variant="secondary" className="mt-5" leftIcon={UserRound}>
          View full profile
        </Button>
      </div>
      <div className="space-y-1 border-t border-line px-3 py-4">
        <Button variant="ghost" className="w-full justify-start" leftIcon={Flag} onClick={actions.onReport}>
          Report {user.fullName.split(' ')[0]}
        </Button>
        <Button variant="danger-ghost" className="w-full justify-start" leftIcon={Eraser} onClick={actions.onClear}>
          Clear chat history
        </Button>
      </div>
    </>
  );
}

export default function ConversationInfoPanel({ conversation, meId, onClose, actions, docked }) {
  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <h2 className="font-semibold text-fg">{conversation.type === 'group' ? 'Group info' : 'Contact info'}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-subtle transition hover:bg-surface-2 hover:text-fg" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pt-5">
        {conversation.type === 'group' ? (
          <GroupInfo conversation={conversation} meId={meId} actions={actions} />
        ) : (
          <DirectInfo conversation={conversation} meId={meId} actions={actions} />
        )}
      </div>
    </div>
  );

  if (docked) {
    return (
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 340, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="h-full shrink-0 overflow-hidden border-l border-line bg-surface/70"
      >
        <div className="h-full w-[340px]">{content}</div>
      </motion.aside>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        className="relative h-full w-full max-w-sm border-l border-line bg-elevated shadow-2xl"
      >
        {content}
      </motion.aside>
    </div>
  );
}
