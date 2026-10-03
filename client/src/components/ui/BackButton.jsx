import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * A regular link to an explicit previous screen (not history.back()), so it never
 * fights the browser's own back/forward navigation.
 */
export default function BackButton({ to, label = 'Back', className }) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pr-4 pl-1.5 text-sm font-medium text-muted backdrop-blur-xl transition-all duration-200',
        'hover:border-brand-500/40 hover:text-fg hover:shadow-lg hover:shadow-brand-900/20 focus-visible:text-fg',
        className
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 transition-colors duration-200 group-hover:bg-brand-500/15 group-hover:text-brand-400">
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
      </span>
      {label}
    </Link>
  );
}
