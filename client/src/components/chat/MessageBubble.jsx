import { memo } from 'react';
import { motion } from 'framer-motion';
import { Ban, ChevronDown, Copy, Flag, Info, Pencil, Reply, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../utils/cn.js';
import { formatTime } from '../../utils/format.js';
import Avatar from '../ui/Avatar.jsx';
import { Menu } from '../ui/Menu.jsx';
import { FileCard, ImageGrid, fileIcon } from './Attachments.jsx';
import MessageStatus from './MessageStatus.jsx';
import RichText, { isEmojiOnly } from './RichText.jsx';

function ReplyQuote({ reply, mine, onJump }) {
  if (!reply) return null;
  if (reply.missing) {
    return <div className={cn('mb-1.5 rounded-lg px-3 py-1.5 text-xs italic', mine ? 'bg-white/10 text-white/70' : 'bg-surface-2 text-subtle')}>Original message unavailable</div>;
  }
  const label = reply.isDeleted
    ? 'This message was deleted'
    : reply.content || (reply.attachment ? (reply.attachment.kind === 'image' ? '📷 Photo' : `📎 ${reply.attachment.name}`) : '');
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.(reply._id);
      }}
      className={cn(
        'mb-1.5 flex w-full min-w-[160px] flex-col items-start rounded-lg border-l-[3px] px-3 py-1.5 text-left transition',
        mine ? 'border-white/70 bg-white/12 hover:bg-white/18' : 'border-brand-500 bg-brand-500/8 hover:bg-brand-500/12'
      )}
    >
      <span className={cn('text-xs font-semibold', mine ? 'text-white' : 'text-accent-fg')}>{reply.sender?.fullName ?? 'Unknown'}</span>
      <span className={cn('line-clamp-2 text-xs', mine ? 'text-white/80' : 'text-muted', reply.isDeleted && 'italic')}>{label}</span>
    </button>
  );
}

function SystemMessage({ message }) {
  return (
    <div className="my-3 flex justify-center px-4">
      <span className="max-w-md rounded-full border border-line bg-surface-2/80 px-3.5 py-1 text-center text-xs text-muted backdrop-blur">
        {message.content}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  isGroup,
  showAvatar,
  showName,
  groupedWithNext,
  status,
  canModerate,
  highlighted,
  animate,
  onReply,
  onEdit,
  onDelete,
  onInfo,
  onReport,
  onRetry,
  onDiscard,
  onOpenImage,
  onJump,
  onMediaLoad,
}) {
  if (message.type === 'system') return <SystemMessage message={message} />;

  const images = message.attachments?.filter((a) => a.kind === 'image') ?? [];
  const files = message.attachments?.filter((a) => a.kind !== 'image') ?? [];
  const deleted = message.isDeleted;
  const transient = message.pending || message.failed;
  const bigEmoji = !deleted && !message.attachments?.length && !message.replyTo && isEmojiOnly(message.content);
  // "onGradient" = content sits on the violet bubble (white text).
  const onGradient = mine && !deleted && !bigEmoji;
  const tone = deleted
    ? mine
      ? 'border border-brand-500/25 bg-brand-500/10 text-accent-fg'
      : 'border border-line bg-surface-2/60 text-muted'
    : mine
      ? 'brand-gradient text-white shadow-brand-900/20'
      : 'border border-line bg-bubble-in text-fg';

  const menuItems = [
    { label: 'Reply', icon: Reply, onClick: () => onReply(message), hidden: deleted || transient },
    {
      label: 'Copy text',
      icon: Copy,
      hidden: deleted || !message.content,
      onClick: () => navigator.clipboard?.writeText(message.content).then(() => toast.success('Copied to clipboard')),
    },
    { label: 'Edit', icon: Pencil, onClick: () => onEdit(message), hidden: !mine || deleted || transient },
    { label: 'Message info', icon: Info, onClick: () => onInfo(message), hidden: !mine || deleted || transient },
    { label: 'Report message', icon: Flag, onClick: () => onReport(message), hidden: mine || deleted },
    { divider: true, hidden: deleted || transient },
    { label: 'Delete for me', icon: Trash2, danger: true, onClick: () => onDelete(message, 'me'), hidden: transient },
    {
      label: 'Delete for everyone',
      icon: Ban,
      danger: true,
      onClick: () => onDelete(message, 'everyone'),
      hidden: deleted || transient || !(mine || canModerate),
    },
  ];

  return (
    <motion.div
      id={`message-${message._id}`}
      initial={animate ? { opacity: 0, y: 14, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cn('group flex w-full items-end gap-2', mine ? 'justify-end' : 'justify-start', groupedWithNext ? 'mb-0.5' : 'mb-3')}
    >
      {!mine && isGroup && (
        <div className="w-8 shrink-0">{showAvatar && <Avatar src={message.sender?.avatarUrl} name={message.sender?.fullName} size="sm" />}</div>
      )}

      <div className={cn('flex max-w-[82%] min-w-0 flex-col sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
        {showName && !mine && isGroup && <span className="mb-1 ml-3 text-xs font-semibold text-accent-fg">{message.sender?.fullName}</span>}

        <div className={cn('flex items-center gap-1', mine ? 'flex-row-reverse' : 'flex-row')}>
          <div
            className={cn(
              'relative min-w-0 rounded-2xl text-[14.5px] leading-relaxed shadow-sm transition-shadow',
              bigEmoji ? 'bg-transparent px-1 shadow-none' : 'px-3.5 py-2',
              !bigEmoji && tone,
              !bigEmoji && !groupedWithNext && (mine ? 'rounded-br-md' : 'rounded-bl-md'),
              message.failed && 'ring-2 ring-rose-500/70',
              highlighted && 'animate-highlight'
            )}
          >
            {deleted ? (
              <p className="flex items-center gap-1.5 text-sm italic opacity-80">
                <Ban className="h-3.5 w-3.5" />
                {message.moderated ? 'Removed by a moderator' : mine ? 'You deleted this message' : 'This message was deleted'}
              </p>
            ) : (
              <>
                <ReplyQuote reply={message.replyTo} mine={mine} onJump={onJump} />
                {images.length > 0 && (
                  <div className={cn(message.content || files.length ? 'mb-2' : '', '-mx-1.5 mt-0.5')}>
                    <ImageGrid images={images} mine={mine} onLoad={onMediaLoad} onOpen={(index) => onOpenImage(images, index)} />
                  </div>
                )}
                {files.length > 0 && (
                  <div className={cn('space-y-1.5', message.content ? 'mb-2' : '')}>
                    {files.map((file) => (
                      <FileCard key={file._id} file={file} mine={mine} />
                    ))}
                  </div>
                )}
                {message.content && <RichText text={message.content} mine={mine} />}
              </>
            )}

            {message.pending && message.progress !== undefined && message.progress < 100 && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                <motion.div className="h-full rounded-full bg-white" animate={{ width: `${message.progress}%` }} />
              </div>
            )}

            <div
              className={cn(
                'mt-0.5 flex items-center justify-end gap-1 text-[10.5px] select-none',
                onGradient ? 'text-white/70' : 'text-subtle'
              )}
            >
              {message.editedAt && !deleted && <span className="italic">edited</span>}
              <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              {mine && !deleted && <MessageStatus status={status} onBubble={onGradient} />}
            </div>
          </div>

          {!transient && (
            <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 touch:opacity-60">
              {!deleted && (
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  className="hidden rounded-full p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg sm:inline-flex"
                  aria-label="Reply"
                  title="Reply"
                >
                  <Reply className="h-4 w-4" />
                </button>
              )}
              <Menu
                align={mine ? 'end' : 'start'}
                trigger={
                  <button type="button" className="rounded-full p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg" aria-label="Message actions">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                }
                items={menuItems}
              />
            </div>
          )}
        </div>

        {message.failed && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-rose-400">{message.error || 'Not sent'}</span>
            <button type="button" onClick={() => onRetry(message)} className="inline-flex items-center gap-1 font-semibold text-accent-fg hover:underline">
              <RotateCw className="h-3 w-3" /> Retry
            </button>
            <button type="button" onClick={() => onDiscard(message)} className="font-semibold text-subtle hover:text-fg">
              Discard
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(MessageBubble);

export function replyPreviewLabel(message) {
  if (!message) return '';
  if (message.content) return message.content;
  const first = message.attachments?.[0];
  if (!first) return '';
  return first.kind === 'image' ? '📷 Photo' : `📎 ${first.name}`;
}

export { fileIcon };
