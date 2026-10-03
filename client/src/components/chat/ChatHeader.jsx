import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, EllipsisVertical, Eraser, Flag, Info, LogOut, Pencil, Trash2, UserPlus, UserRound } from 'lucide-react';
import { getConversationDisplay, getMyState } from '../../utils/conversation.js';
import { describeTyping, presenceStore, useStore, usePresence, useTypingMap } from '../../utils/stores.js';
import { formatLastSeen } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Menu } from '../ui/Menu.jsx';
import { TypingDots } from './TypingIndicator.jsx';

function useOnlineMembers(conversation, meId) {
  const presence = useStore(presenceStore, (state) => state);
  return useMemo(
    () =>
      conversation.participants.filter((p) => {
        if (p.user._id === meId) return false;
        const live = presence[p.user._id];
        return live ? live.isOnline : p.user.isOnline;
      }).length,
    [conversation.participants, presence, meId]
  );
}

export default function ChatHeader({ conversation, meId, infoOpen, onToggleInfo, actions }) {
  const navigate = useNavigate();
  const display = getConversationDisplay(conversation, meId);
  const presence = usePresence(display.user);
  const typingMap = useTypingMap(conversation._id);
  const onlineMembers = useOnlineMembers(conversation, meId);
  const typingNames = Object.entries(typingMap)
    .filter(([id]) => id !== meId)
    .map(([, name]) => name);
  const myRole = getMyState(conversation, meId)?.role;
  const isGroupAdmin = myRole === 'owner' || myRole === 'admin';

  let subtitle;
  if (typingNames.length) {
    subtitle = (
      <span className="flex items-center gap-1.5 text-brand-400">
        <TypingDots className="text-brand-400" />
        {display.isGroup ? describeTyping(typingNames) : 'typing'}…
      </span>
    );
  } else if (display.isGroup) {
    subtitle = `${conversation.participants.length} members${onlineMembers ? ` · ${onlineMembers} online` : ''}`;
  } else {
    subtitle = presence.isOnline ? <span className="text-emerald-500">Online</span> : formatLastSeen(presence.lastSeen);
  }

  const menuItems = display.isGroup
    ? [
        { label: 'Group info', icon: Info, onClick: onToggleInfo },
        { label: 'Edit group', icon: Pencil, onClick: actions.onEditGroup, hidden: !isGroupAdmin },
        { label: 'Add members', icon: UserPlus, onClick: actions.onAddMembers, hidden: !isGroupAdmin },
        { label: 'Report group', icon: Flag, onClick: actions.onReport },
        { divider: true },
        { label: 'Leave group', icon: LogOut, danger: true, onClick: actions.onLeave },
        { label: 'Delete group', icon: Trash2, danger: true, onClick: actions.onDelete, hidden: myRole !== 'owner' },
      ]
    : [
        { label: 'View profile', icon: UserRound, onClick: () => navigate(`/users/${display.user?._id}`) },
        { label: 'Contact info', icon: Info, onClick: onToggleInfo },
        { label: 'Report user', icon: Flag, onClick: actions.onReport },
        { divider: true },
        { label: 'Clear chat', icon: Eraser, danger: true, onClick: actions.onClear },
      ];

  return (
    <header className="glass z-10 flex h-16 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-4">
      <IconButton icon={ArrowLeft} label="Back to conversations" className="md:hidden" onClick={() => navigate('/chats')} />
      <button type="button" onClick={onToggleInfo} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-surface-2/60">
        <Avatar src={display.avatarUrl} name={display.name} isGroup={display.isGroup} online={display.isGroup ? undefined : presence.isOnline} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-fg">{display.name}</span>
          <span className={cn('block truncate text-xs text-muted')}>{subtitle}</span>
        </span>
      </button>
      <IconButton icon={Info} label={display.isGroup ? 'Group info' : 'Contact info'} active={infoOpen} onClick={onToggleInfo} className="hidden sm:inline-flex" />
      <Menu trigger={<IconButton icon={EllipsisVertical} label="More options" />} items={menuItems} />
    </header>
  );
}
