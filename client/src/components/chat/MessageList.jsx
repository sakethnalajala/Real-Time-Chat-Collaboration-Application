import { Fragment, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Loader2, MessageCircleDashed } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { formatDayLabel } from '../../utils/format.js';
import { getMessageStatus } from '../../utils/conversation.js';
import MessageBubble from './MessageBubble.jsx';
import { TypingBubble } from './TypingIndicator.jsx';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 160;

const dayKey = (value) => new Date(value).toDateString();

function DateDivider({ date }) {
  return (
    <div className="sticky top-2 z-10 my-4 flex justify-center">
      <span className="glass rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">{formatDayLabel(date)}</span>
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-brand-500/40" />
      <span className="text-[11px] font-semibold tracking-wide text-accent-fg uppercase">Unread messages</span>
      <span className="h-px flex-1 bg-brand-500/40" />
    </div>
  );
}

/**
 * Scroll behaviour:
 *  - opens at the bottom
 *  - loads older pages when the top sentinel becomes visible, keeping the viewport anchored
 *  - follows new messages only when already near the bottom (or for my own messages);
 *    otherwise shows a "new messages" pill
 */
export default function MessageList({
  ref,
  conversation,
  messages,
  meId,
  canModerate,
  hasMore,
  isFetchingOlder,
  onLoadOlder,
  typingLabel,
  unreadAnchor,
  ...handlers
}) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const snapshot = useRef({ firstId: null, lastId: null, scrollHeight: 0, scrollTop: 0 });
  const mountedAt = useRef(Date.now());
  const [newBelow, setNewBelow] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const isGroup = conversation?.type === 'group';

  const distanceFromBottom = () => {
    const el = scrollRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
  };

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewBelow(0);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = snapshot.current;
    const firstId = messages[0]?._id ?? null;
    const lastId = messages.at(-1)?._id ?? null;

    if (!prev.lastId && lastId) {
      el.scrollTop = el.scrollHeight; // first render
    } else if (prev.firstId && firstId !== prev.firstId && lastId === prev.lastId) {
      el.scrollTop = el.scrollHeight - prev.scrollHeight + prev.scrollTop; // older page prepended
    } else if (lastId && lastId !== prev.lastId) {
      const last = messages.at(-1);
      const wasNearBottom = prev.scrollHeight - prev.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      if (wasNearBottom || last?.sender?._id === meId) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else if (!last?.pending) {
        setNewBelow((n) => n + 1);
      }
    }
    snapshot.current = { firstId, lastId, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
  }, [messages, meId]);

  // Keep the typing bubble in view when it appears at the bottom.
  useEffect(() => {
    if (typingLabel && distanceFromBottom() < NEAR_BOTTOM_PX) scrollToBottom();
  }, [typingLabel, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingOlder) onLoadOlder();
      },
      { root: el, rootMargin: '300px 0px 0px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingOlder, onLoadOlder]);

  const onScroll = () => {
    const el = scrollRef.current;
    snapshot.current.scrollTop = el.scrollTop;
    snapshot.current.scrollHeight = el.scrollHeight;
    const distance = distanceFromBottom();
    setShowJump(distance > 500);
    if (distance < NEAR_BOTTOM_PX) setNewBelow(0);
  };

  const onMediaLoad = useCallback(() => {
    if (distanceFromBottom() < 320) scrollToBottom('auto');
  }, [scrollToBottom]);

  const highlight = useCallback((id) => {
    const node = document.getElementById(`message-${id}`);
    if (!node) return false;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1900);
    return true;
  }, []);

  useImperativeHandle(ref, () => ({ scrollToBottom, highlight }), [scrollToBottom, highlight]);

  const rows = useMemo(() => {
    let unreadPlaced = false;
    return messages.map((message, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const newDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
      const sameSenderAsPrev =
        prev && !newDay && prev.type !== 'system' && prev.sender?._id === message.sender?._id && new Date(message.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW_MS;
      const sameSenderAsNext =
        next &&
        next.type !== 'system' &&
        dayKey(next.createdAt) === dayKey(message.createdAt) &&
        next.sender?._id === message.sender?._id &&
        new Date(next.createdAt) - new Date(message.createdAt) < GROUP_WINDOW_MS;

      let unreadHere = false;
      if (!unreadPlaced && unreadAnchor && message.sender && message.sender._id !== meId && new Date(message.createdAt) > new Date(unreadAnchor)) {
        unreadPlaced = true;
        unreadHere = true;
      }
      return { message, newDay, showName: !sameSenderAsPrev, showAvatar: !sameSenderAsNext, groupedWithNext: Boolean(sameSenderAsNext), unreadHere };
    });
  }, [messages, meId, unreadAnchor]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="chat-pattern h-full overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-6" role="log" aria-live="polite">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-end">
          <div ref={sentinelRef} />
          {isFetchingOlder && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            </div>
          )}
          {!hasMore && messages.length > 0 && (
            <div className="mb-4 flex flex-col items-center gap-2 pt-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                <MessageCircleDashed className="h-5 w-5" />
              </span>
              <p className="text-xs text-subtle">This is the beginning of your conversation history.</p>
            </div>
          )}

          {rows.map(({ message, newDay, showName, showAvatar, groupedWithNext, unreadHere }) => {
            const mine = message.sender?._id === meId;
            return (
              <Fragment key={message.clientMsgId || message._id}>
                {newDay && <DateDivider date={message.createdAt} />}
                {unreadHere && <UnreadDivider />}
                <MessageBubble
                  message={message}
                  mine={mine}
                  isGroup={isGroup}
                  showName={showName}
                  showAvatar={showAvatar}
                  groupedWithNext={groupedWithNext}
                  status={mine ? getMessageStatus(message, conversation, meId) : null}
                  canModerate={canModerate}
                  highlighted={highlightId === message._id}
                  animate={new Date(message.createdAt).getTime() > mountedAt.current || message.pending}
                  onMediaLoad={onMediaLoad}
                  {...handlers}
                />
              </Fragment>
            );
          })}

          <AnimatePresence>
            {typingLabel && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-1 mb-2">
                <TypingBubble label={typingLabel} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {(showJump || newBelow > 0) && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            onClick={() => scrollToBottom()}
            className={cn(
              'absolute right-4 bottom-4 flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-2 text-xs font-semibold text-fg shadow-xl shadow-black/20',
              newBelow > 0 && 'border-brand-500/40'
            )}
            aria-label="Jump to latest messages"
          >
            <ArrowDown className="h-4 w-4 text-brand-400" />
            {newBelow > 0 ? `${newBelow} new message${newBelow > 1 ? 's' : ''}` : 'Latest'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
