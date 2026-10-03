import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import Button from './Button.jsx';
import Logo from './Logo.jsx';

export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function Spinner({ className, label }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…', fullScreen = false }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', fullScreen ? 'h-dvh bg-bg' : 'h-full min-h-[50vh]')}>
      <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <Logo showText={false} size="lg" />
      </motion.div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-8' : 'gap-3 py-14', className)}
    >
      {Icon && (
        <div className="relative mb-1">
          <div className="absolute inset-0 rounded-full bg-brand-500/25 blur-2xl" />
          <div className={cn('relative flex items-center justify-center rounded-2xl border border-brand-500/25 bg-brand-500/10 text-brand-400', compact ? 'h-12 w-12' : 'h-16 w-16')}>
            <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden />
          </div>
        </div>
      )}
      <h3 className={cn('font-semibold text-fg', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className, compact }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="font-semibold text-fg">{title}</h3>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className, dot }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    brand: 'bg-brand-500/12 text-accent-fg border-brand-500/25',
    success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25',
    danger: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25',
    info: 'bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function CountBadge({ count, className }) {
  if (!count) return null;
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white shadow-md shadow-brand-700/30', className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
