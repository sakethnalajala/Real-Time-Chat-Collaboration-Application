import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const LABELS = { sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Not sent' };

/** WhatsApp-style ticks: clock → ✓ sent → ✓✓ delivered → ✓✓ (violet) read. */
export default function MessageStatus({ status, className, onBubble = false }) {
  if (!status) return null;
  const base = cn('h-3.5 w-3.5 shrink-0', className);
  const label = LABELS[status];
  const muted = onBubble ? 'text-white/70' : 'text-subtle';

  if (status === 'sending') return <Clock3 className={cn(base, muted)} aria-label={label} />;
  if (status === 'failed') return <AlertCircle className={cn(base, 'text-rose-400')} aria-label={label} />;
  if (status === 'sent') return <Check className={cn(base, muted)} aria-label={label} />;
  return (
    <CheckCheck
      className={cn(base, status === 'read' ? (onBubble ? 'text-sky-300' : 'text-brand-400') : muted)}
      aria-label={label}
    />
  );
}
