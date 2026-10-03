import { useState } from 'react';
import { Users } from 'lucide-react';
import { assetUrl } from '../../config/env.js';
import { cn } from '../../utils/cn.js';
import { initials } from '../../utils/format.js';

const SIZES = {
  xs: { box: 'h-6 w-6 text-[10px]', dot: 'h-2 w-2 ring-[1.5px]' },
  sm: { box: 'h-8 w-8 text-xs', dot: 'h-2.5 w-2.5 ring-2' },
  md: { box: 'h-10 w-10 text-sm', dot: 'h-3 w-3 ring-2' },
  lg: { box: 'h-12 w-12 text-base', dot: 'h-3.5 w-3.5 ring-2' },
  xl: { box: 'h-16 w-16 text-xl', dot: 'h-4 w-4 ring-[3px]' },
  '2xl': { box: 'h-24 w-24 text-3xl', dot: 'h-5 w-5 ring-4' },
  '3xl': { box: 'h-32 w-32 text-4xl', dot: 'h-6 w-6 ring-4' },
};

const GRADIENTS = [
  'from-violet-500 to-fuchsia-600',
  'from-indigo-500 to-violet-700',
  'from-purple-500 to-pink-500',
  'from-fuchsia-500 to-rose-500',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-600 to-indigo-800',
];

const gradientFor = (seed = '') => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

export default function Avatar({ src, name = '', size = 'md', online, isGroup = false, className, rounded = 'rounded-full' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const url = src && failedSrc !== src ? assetUrl(src) : null;
  const s = SIZES[size] || SIZES.md;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {url ? (
        <img
          src={url}
          alt={name ? `${name}'s avatar` : 'Avatar'}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className={cn(s.box, rounded, 'bg-surface-2 object-cover ring-1 ring-line')}
        />
      ) : (
        <span
          aria-label={name}
          className={cn(
            s.box,
            rounded,
            'flex items-center justify-center bg-linear-to-br font-semibold text-white ring-1 ring-white/10',
            gradientFor(name)
          )}
        >
          {isGroup && !name ? <Users className="h-1/2 w-1/2" /> : initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={cn('absolute right-0 bottom-0 rounded-full ring-surface', s.dot, online ? 'bg-emerald-500' : 'bg-zinc-500/80')}>
          {online && <span className="absolute inset-0 animate-ping-slow rounded-full bg-emerald-400" />}
          <span className="sr-only">{online ? 'Online' : 'Offline'}</span>
        </span>
      )}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u) => (
        <Avatar key={u._id} src={u.avatarUrl} name={u.fullName} size={size} className="rounded-full ring-2 ring-surface" />
      ))}
      {extra > 0 && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </div>
  );
}
