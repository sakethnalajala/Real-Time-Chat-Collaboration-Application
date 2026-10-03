import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Hand, MessageSquareOff, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import ChatHeader from '../../components/chat/ChatHeader.jsx';
import Composer, { mergeFiles } from '../../components/chat/Composer.jsx';
import ConversationInfoPanel from '../../components/chat/ConversationInfoPanel.jsx';
import MessageList from '../../components/chat/MessageList.jsx';
import { MessageInfoModal, ReportModal } from '../../components/chat/MessageModals.jsx';
import { Lightbox } from '../../components/chat/Attachments.jsx';
import { AddMembersModal, EditGroupModal } from '../../components/group/GroupModals.jsx';
import Button from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { conversationKeys, useConversation } from '../../hooks/useConversations.js';
import { useConversationFocus, useMarkRead, useMessageActions, useSendMessage, useTypingEmitter } from '../../hooks/useChatActions.js';
import { useDocumentTitle, useMediaQuery } from '../../hooks/useUtils.js';
import { conversationService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { getConversationDisplay, getMyState } from '../../utils/conversation.js';
import { flattenMessages } from '../../utils/messageCache.js';
import { describeTyping, useTypingMap } from '../../utils/stores.js';

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-line px-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <MessagesSkeleton />
    </div>
  );
}

function MessagesSkeleton() {
  const rows = [
    ['left', 'w-48'],
    ['left', 'w-64'],
    ['right', 'w-40'],
    ['left', 'w-56'],
    ['right', 'w-72'],
    ['right', 'w-36'],
  ];
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-6 py-6">
      {rows.map(([side, width], i) => (
        <div key={i} className={side === 'right' ? 'flex justify-end' : 'flex'}>
          <Skeleton className={`h-11 rounded-2xl ${width}`} />
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const { conversationId } = useParams();
  // Remount per conversation so drafts, scroll position and dialogs never leak between chats.
  return <ChatView key={conversationId} conversationId={conversationId} />;
}

function ChatView({ conversationId }) {
  const { user } = useAuth();
  const meId = user._id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config } = useAppConfig();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const listRef = useRef(null);
  const messagesKey = conversationKeys.messages(conversationId);

  const { data: conversation, isLoading, isError, error, refetch } = useConversation(conversationId);
  const messagesQuery = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) => conversationService.messages(conversationId, { before: pageParam, limit: 30 }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(conversation),
    staleTime: 30_000,
  });
  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);

  const visible = useConversationFocus(conversationId);
  const markRead = useMarkRead(conversationId);
  const { send, retry, discard } = useSendMessage(conversationId);
  const { edit, remove } = useMessageActions(conversationId);
  const { onType, stop } = useTypingEmitter(conversationId);
  const typingMap = useTypingMap(conversationId);

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [files, setFiles] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [lightbox, setLightbox] = useState({ images: [], index: null });
  const [dragging, setDragging] = useState(false);

  const display = conversation ? getConversationDisplay(conversation, meId) : null;
  const myState = conversation ? getMyState(conversation, meId) : null;
  const myRole = myState?.role;
  const canModerate = conversation?.type === 'group' && (myRole === 'owner' || myRole === 'admin');
  useDocumentTitle(display ? `${display.name} · Nebula Chat` : 'Chat · Nebula Chat');

  // Where the "Unread messages" divider goes — captured once when the chat opens.
  const unreadAnchor = useRef(undefined);
  if (unreadAnchor.current === undefined && myState) {
    unreadAnchor.current = myState.unreadCount > 0 ? myState.lastReadAt || myState.joinedAt : null;
  }

  // Mark as read whenever unseen messages are on screen.
  const unread = myState?.unreadCount ?? 0;
  const lastMessageAt = conversation?.lastMessageAt;
  const lastReadAt = myState?.lastReadAt;
  const markedKey = useRef(null);
  useEffect(() => {
    if (!conversation || !visible || !messagesQuery.isSuccess) return;
    const unseen = unread > 0 || (lastMessageAt && (!lastReadAt || new Date(lastReadAt) < new Date(lastMessageAt)));
    const key = `${lastMessageAt}:${unread}`;
    if (unseen && markedKey.current !== key) {
      markedKey.current = key;
      markRead();
    }
  }, [Boolean(conversation), visible, unread, lastMessageAt, lastReadAt, messagesQuery.isSuccess, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  const typingLabel = useMemo(() => {
    const names = Object.entries(typingMap)
      .filter(([id]) => id !== meId)
      .map(([, name]) => name);
    return names.length ? describeTyping(names) : '';
  }, [typingMap, meId]);

  const loadOlder = useCallback(() => {
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) messagesQuery.fetchNextPage();
  }, [messagesQuery]);

  const jumpTo = useCallback(
    async (messageId) => {
      if (listRef.current?.highlight(messageId)) return;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const data = queryClient.getQueryData(messagesKey);
        if (!data?.pages.at(-1)?.hasMore) break;
        await messagesQuery.fetchNextPage();
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (listRef.current?.highlight(messageId)) return;
      }
      toast.info('The original message is not available in this chat.');
    },
    [queryClient, messagesKey, messagesQuery]
  );

  /* ----------------------------- message actions ----------------------------- */

  const handlers = useMemo(
    () => ({
      onReply: (message) => {
        setEditing(null);
        setReplyTo(message);
      },
      onEdit: (message) => {
        setReplyTo(null);
        setEditing(message);
      },
      onDelete: (message, scope) => setDialog({ type: 'delete', message, scope }),
      onInfo: (message) => setDialog({ type: 'info', message }),
      onReport: (message) =>
        setDialog({ type: 'report', target: { type: 'message', id: message._id, label: `Message from ${message.sender?.fullName ?? 'a member'}` } }),
      onRetry: (message) => retry(message),
      onDiscard: (message) => discard(message),
      onOpenImage: (images, index) => setLightbox({ images, index }),
      onJump: (id) => jumpTo(id),
    }),
    [retry, discard, jumpTo]
  );

  const saveEdit = useCallback(
    async (message, content) => {
      try {
        await edit(message, content);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Could not edit the message'));
        throw err;
      }
    },
    [edit]
  );

  const conversationActions = useMemo(() => {
    const other = display?.user;
    return {
      onEditGroup: () => setDialog({ type: 'editGroup' }),
      onAddMembers: () => setDialog({ type: 'addMembers' }),
      onLeave: () => setDialog({ type: 'leave' }),
      onDelete: () => setDialog({ type: 'deleteGroup' }),
      onClear: () => setDialog({ type: 'clear' }),
      onReport: () =>
        setDialog({
          type: 'report',
          target:
            conversation?.type === 'group'
              ? { type: 'conversation', id: conversationId, label: conversation.group?.name }
              : { type: 'user', id: other?._id, label: other?.fullName },
        }),
    };
  }, [conversation, conversationId, display?.user]);

  const forgetConversation = () => {
    queryClient.setQueryData(conversationKeys.list, (list) => list?.filter((c) => c._id !== conversationId));
    queryClient.removeQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.removeQueries({ queryKey: messagesKey });
  };

  const runDialog = async () => {
    if (!dialog) return;
    setDialogBusy(true);
    try {
      if (dialog.type === 'delete') {
        await remove(dialog.message, dialog.scope);
        toast.success(dialog.scope === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you');
      } else if (dialog.type === 'leave') {
        await conversationService.leave(conversationId);
        forgetConversation();
        toast.success(`You left ${conversation.group?.name}`);
        navigate('/chats', { replace: true });
      } else if (dialog.type === 'deleteGroup' || dialog.type === 'clear') {
        await conversationService.remove(conversationId);
        forgetConversation();
        toast.success(dialog.type === 'clear' ? 'Chat history cleared' : 'Group deleted');
        navigate('/chats', { replace: true });
      }
      setDialog(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ drag & drop ------------------------------ */

  const dragProps = {
    onDragEnter: (event) => {
      if (event.dataTransfer?.types?.includes('Files')) setDragging(true);
    },
    onDragOver: (event) => {
      if (dragging) event.preventDefault();
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      if (editing) return;
      setFiles((current) => mergeFiles(current, Array.from(event.dataTransfer?.files || []), config.uploads));
    },
  };

  /* -------------------------------- render -------------------------------- */

  if (isLoading) return <ChatSkeleton />;

  if (isError || !conversation) {
    const notFound = error?.response?.status === 404 || !conversation;
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        {notFound ? (
          <EmptyState
            icon={MessageSquareOff}
            title="Conversation not found"
            description="It may have been deleted, or you're no longer a member."
            action={
              <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate('/chats')}>
                Back to chats
              </Button>
            }
          />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        )}
      </div>
    );
  }

  const confirmCopy = {
    delete:
      dialog?.scope === 'everyone'
        ? { title: 'Delete for everyone?', description: 'The message will be replaced with "This message was deleted" for all members.', confirm: 'Delete for everyone' }
        : { title: 'Delete for you?', description: 'The message disappears from your view only. Others can still see it.', confirm: 'Delete for me' },
    leave: { title: `Leave ${conversation.group?.name}?`, description: "You'll stop receiving messages from this group.", confirm: 'Leave group' },
    deleteGroup: {
      title: 'Delete this group?',
      description: 'The group, its messages and shared files will be permanently deleted for every member.',
      confirm: 'Delete group',
    },
    clear: { title: 'Clear chat history?', description: 'Messages will be removed from your view. The other person keeps their copy.', confirm: 'Clear chat' },
  }[dialog?.type];

  return (
    <div className="flex h-full" {...dragProps}>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <ChatHeader
          conversation={conversation}
          meId={meId}
          infoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen((open) => !open)}
          actions={conversationActions}
        />

        {messagesQuery.isLoading ? (
          <MessagesSkeleton />
        ) : messagesQuery.isError ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState message={getErrorMessage(messagesQuery.error, 'Could not load messages')} onRetry={() => messagesQuery.refetch()} />
          </div>
        ) : messages.length === 0 && !typingLabel ? (
          <div className="chat-pattern flex flex-1 items-center justify-center px-6">
            <EmptyState
              icon={Hand}
              title="No messages yet"
              description={conversation.type === 'group' ? 'Kick things off with a hello to the group.' : `Say hi to ${display.name.split(' ')[0]} — they'll see it instantly.`}
              action={
                <Button variant="secondary" onClick={() => send({ content: '👋' })}>
                  👋 Wave hello
                </Button>
              }
            />
          </div>
        ) : (
          <MessageList
            ref={listRef}
            conversation={conversation}
            messages={messages}
            meId={meId}
            canModerate={canModerate}
            hasMore={Boolean(messagesQuery.hasNextPage)}
            isFetchingOlder={messagesQuery.isFetchingNextPage}
            onLoadOlder={loadOlder}
            typingLabel={typingLabel}
            unreadAnchor={unreadAnchor.current}
            {...handlers}
          />
        )}

        <Composer
          conversationId={conversationId}
          replyTo={replyTo}
          editing={editing}
          files={files}
          onFilesChange={setFiles}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSend={send}
          onSaveEdit={saveEdit}
          onTyping={onType}
          onStopTyping={stop}
          uploads={config.uploads}
          maxLength={config.limits?.messageMaxLength ?? 4000}
        />

        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-brand-500 bg-brand-500/10 backdrop-blur-sm"
            >
              <UploadCloud className="h-10 w-10 text-brand-400" />
              <p className="font-semibold text-fg">Drop files to share</p>
              <p className="text-xs text-muted">
                Images, PDFs, documents and archives up to {config.uploads?.maxFileSizeMB ?? 10} MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {infoOpen && (
          <ConversationInfoPanel
            conversation={conversation}
            meId={meId}
            docked={isWide}
            onClose={() => setInfoOpen(false)}
            actions={conversationActions}
          />
        )}
      </AnimatePresence>

      <Lightbox
        images={lightbox.images}
        index={lightbox.index}
        onClose={() => setLightbox({ images: [], index: null })}
        onIndexChange={(index) => setLightbox((current) => ({ ...current, index }))}
      />
      <MessageInfoModal message={dialog?.type === 'info' ? dialog.message : null} onClose={() => setDialog(null)} />
      <ReportModal target={dialog?.type === 'report' ? dialog.target : null} onClose={() => setDialog(null)} />
      {conversation.type === 'group' && (
        <>
          <AddMembersModal open={dialog?.type === 'addMembers'} onClose={() => setDialog(null)} conversation={conversation} />
          <EditGroupModal open={dialog?.type === 'editGroup'} onClose={() => setDialog(null)} conversation={conversation} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirmCopy)}
        onClose={() => setDialog(null)}
        onConfirm={runDialog}
        loading={dialogBusy}
        title={confirmCopy?.title}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirm}
      />
    </div>
  );
}
