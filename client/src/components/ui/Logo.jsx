import { APP_NAME } from '../../config/env.js';
import { cn } from '../../utils/cn.js';

const SIZES = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-12 w-12' };

export default function Logo({ showText = true, size = 'md', className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('relative flex items-center justify-center rounded-xl brand-gradient shadow-lg shadow-brand-700/40', SIZES[size])}>
        <svg viewBox="0 0 32 32" className="h-[62%] w-[62%]" aria-hidden>
          <path
            d="M5 10a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-8l-6 5v-5.3A5 5 0 0 1 5 18Z"
            fill="white"
            fillOpacity="0.95"
          />
          <circle cx="11.5" cy="14" r="1.7" fill="#6d28d9" />
          <circle cx="16" cy="14" r="1.7" fill="#6d28d9" />
          <circle cx="20.5" cy="14" r="1.7" fill="#6d28d9" />
        </svg>
      </span>
      {showText && <span className="text-lg font-bold tracking-tight text-fg">{APP_NAME}</span>}
    </span>
  );
}
