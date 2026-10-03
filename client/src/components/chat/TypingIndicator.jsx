import { cn } from '../../utils/cn.js';

export function TypingDots({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-typing rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/** Bubble-shaped indicator shown at the bottom of the message list. */
export function TypingBubble({ label }) {
  return (
    <div className="flex items-end gap-2 px-1" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-bubble-in px-4 py-3 text-muted shadow-sm">
        <TypingDots />
      </div>
      <span className="pb-1 text-xs text-subtle">{label}…</span>
    </div>
  );
}
