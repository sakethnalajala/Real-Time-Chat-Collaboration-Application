import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Paperclip, Pencil, Reply, SendHorizontal, Smile, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useClickOutside, useMediaQuery, useObjectUrl } from '../../hooks/useUtils.js';
import { cn } from '../../utils/cn.js';
import { formatBytes } from '../../utils/format.js';
import { Spinner } from '../ui/Feedback.jsx';
import { fileIcon } from './Attachments.jsx';
import { replyPreviewLabel } from './MessageBubble.jsx';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function PendingFile({ file, onRemove }) {
  const isImage = IMAGE_TYPES.includes(file.type);
  const url = useObjectUrl(isImage ? file : null);
  const { icon: Icon, tone } = fileIcon(file.type, file.name);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border border-line bg-surface-2"
    >
      {isImage && url ? (
        <img src={url} alt={file.name} className="h-16 w-16 object-cover" />
      ) : (
        <div className="flex max-w-[200px] items-center gap-2 py-2 pr-8 pl-2">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{file.name}</span>
            <span className="block text-[11px] text-subtle">{formatBytes(file.size)}</span>
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-90 transition hover:bg-black/80"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function ContextBar({ icon: Icon, title, text, onClose }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="mb-2 flex items-center gap-3 rounded-xl border-l-[3px] border-brand-500 bg-brand-500/8 py-2 pr-2 pl-3">
        <Icon className="h-4 w-4 shrink-0 text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-accent-fg">{title}</p>
          <p className="truncate text-xs text-muted">{text}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg" aria-label="Cancel">
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

/** Validates new files against the server limits (type, size, count) and returns the merged list. */
export function mergeFiles(current, incoming, uploads) {
  if (!incoming.length) return current;
  if (!uploads?.enabled) {
    toast.error('File sharing is not configured on this server yet.');
    return current;
  }
  const maxBytes = uploads.maxFileSizeMB * 1024 * 1024;
  const accepted = [];
  for (const file of incoming) {
    if (uploads.accept?.length && !uploads.accept.includes(file.type)) {
      toast.error(`"${file.name}" is not a supported file type`);
    } else if (file.size > maxBytes) {
      toast.error(`"${file.name}" is larger than ${uploads.maxFileSizeMB} MB`);
    } else {
      accepted.push(file);
    }
  }
  const room = uploads.maxFilesPerMessage - current.length;
  if (accepted.length > room) toast.error(`You can attach up to ${uploads.maxFilesPerMessage} files per message`);
  return room > 0 ? [...current, ...accepted.slice(0, room)] : current;
}

export default function Composer({
  conversationId,
  replyTo,
  editing,
  files,
  onFilesChange,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
  onStopTyping,
  uploads,
  maxLength = 4000,
  disabledReason,
}) {
  const { resolvedTheme } = useTheme();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const emojiRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const draftRef = useRef('');
  const coarsePointer = useMediaQuery('(pointer: coarse)');

  useClickOutside([emojiRef, emojiButtonRef], () => setEmojiOpen(false), emojiOpen);

  // Entering edit mode loads the message; leaving it restores the draft.
  useEffect(() => {
    if (editing) {
      draftRef.current = text;
      setText(editing.content || '');
    } else if (draftRef.current !== null) {
      setText(draftRef.current);
      draftRef.current = '';
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?._id]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    setText('');
    setEmojiOpen(false);
  }, [conversationId]);

  // Auto-grow the textarea up to ~8 lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const addFiles = (incoming) => onFilesChange(mergeFiles(files, incoming, uploads));

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    onTyping?.();
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const trimmed = text.trim();
  const canSend = !disabledReason && (editing ? Boolean(trimmed) || editing.attachments?.length > 0 : Boolean(trimmed) || files.length > 0);

  const submit = async () => {
    if (!canSend || saving) return;
    if (editing) {
      if (trimmed === (editing.content || '').trim()) return onCancelEdit();
      setSaving(true);
      try {
        await onSaveEdit(editing, trimmed);
        onCancelEdit();
      } catch {
        /* stay in edit mode; the caller shows the error */
      } finally {
        setSaving(false);
      }
      return;
    }
    onSend({ content: trimmed, files, replyTo });
    setText('');
    onFilesChange([]);
    onCancelReply();
    onStopTyping?.();
    setEmojiOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !coarsePointer && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape') {
      if (editing) onCancelEdit();
      else if (replyTo) onCancelReply();
      setEmojiOpen(false);
    }
  };

  if (disabledReason) {
    return (
      <div className="border-t border-line bg-surface/80 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-muted">
        {disabledReason}
      </div>
    );
  }

  return (
    <div className="glass relative border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto max-w-4xl">
        <AnimatePresence initial={false}>
          {editing ? (
            <ContextBar key="edit" icon={Pencil} title="Editing message" text={replyPreviewLabel(editing)} onClose={onCancelEdit} />
          ) : replyTo ? (
            <ContextBar
              key={`reply-${replyTo._id}`}
              icon={Reply}
              title={`Replying to ${replyTo.sender?.fullName ?? 'message'}`}
              text={replyPreviewLabel(replyTo)}
              onClose={onCancelReply}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {files.length > 0 && !editing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                <AnimatePresence>
                  {files.map((file, index) => (
                    <PendingFile key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={() => onFilesChange(files.filter((_, i) => i !== index))} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg', emojiOpen && 'bg-surface-2 text-brand-400')}
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
            >
              <Smile className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {emojiOpen && (
                <motion.div
                  ref={emojiRef}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute bottom-full left-0 z-30 mb-2 origin-bottom-left overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/40"
                >
                  <Suspense
                    fallback={
                      <div className="flex h-[380px] w-[320px] items-center justify-center bg-elevated">
                        <Spinner />
                      </div>
                    }
                  >
                    <EmojiPicker
                      onEmojiClick={(data) => insertEmoji(data.emoji)}
                      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                      emojiStyle="native"
                      lazyLoadEmojis
                      width={Math.min(340, window.innerWidth - 32)}
                      height={380}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!editing && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!uploads?.enabled}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Attach files"
                title={uploads?.enabled ? `Attach images or files (up to ${uploads.maxFileSizeMB} MB each)` : 'File sharing is not configured on this server yet'}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={uploads?.accept?.join(',')}
                className="hidden"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files || []));
                  event.target.value = '';
                }}
              />
            </>
          )}

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={text}
              rows={1}
              maxLength={maxLength}
              onChange={(event) => {
                setText(event.target.value);
                if (!editing && event.target.value) onTyping?.();
              }}
              onKeyDown={onKeyDown}
              onPaste={(event) => {
                const pasted = Array.from(event.clipboardData?.files || []);
                if (pasted.length && !editing) {
                  event.preventDefault();
                  addFiles(pasted);
                }
              }}
              placeholder={editing ? 'Edit your message…' : files.length ? 'Add a caption…' : 'Type a message…'}
              aria-label="Message"
              className="block max-h-[200px] min-h-11 w-full resize-none rounded-2xl border border-line bg-surface-2/70 px-4 py-[11px] text-[14.5px] leading-snug text-fg transition outline-none placeholder:text-subtle focus:border-brand-500 focus:bg-surface focus:ring-4 focus:ring-brand-500/15"
            />
            {text.length > maxLength - 300 && (
              <span className={cn('absolute right-3 -top-5 text-[11px]', text.length >= maxLength ? 'text-rose-500' : 'text-subtle')}>
                {text.length}/{maxLength}
              </span>
            )}
          </div>

          <motion.button
            type="button"
            onClick={submit}
            disabled={!canSend || saving}
            whileTap={canSend ? { scale: 0.9 } : undefined}
            animate={{ scale: canSend ? 1 : 0.94, opacity: canSend ? 1 : 0.5 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-lg shadow-brand-700/30 disabled:cursor-not-allowed disabled:shadow-none"
            aria-label={editing ? 'Save edit' : 'Send message'}
          >
            {editing ? <Check className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export { IMAGE_TYPES };
