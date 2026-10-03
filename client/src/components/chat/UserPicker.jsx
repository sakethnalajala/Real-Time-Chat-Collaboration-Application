import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, SearchX, X } from 'lucide-react';
import { userService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { useDebounce } from '../../hooks/useUtils.js';
import { usePresence } from '../../utils/stores.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import { EmptyState, ErrorState, Skeleton } from '../ui/Feedback.jsx';
import { SearchInput } from '../ui/Input.jsx';

export function useUserSearch(query, { limit = 30 } = {}) {
  const debounced = useDebounce(query.trim(), 250);
  return useQuery({
    queryKey: ['users', 'search', debounced, limit],
    queryFn: () => userService.search({ q: debounced, limit }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function UserRow({ user, selected, onClick, trailing, disabled }) {
  const presence = usePresence(user);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'bg-brand-500/10' : 'hover:bg-surface-2'
      )}
    >
      <Avatar src={user.avatarUrl} name={user.fullName} online={presence.isOnline} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{user.fullName}</span>
        <span className="block truncate text-xs text-subtle">@{user.username}</span>
      </span>
      {trailing}
      {selected !== undefined && (
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md border transition',
            selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-line-strong'
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  );
}

export function UserListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Multi-select people picker used for creating groups and adding members. */
export default function UserPicker({ selected, onChange, excludeIds = [], max = 99 }) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, error, refetch } = useUserSearch(query);
  const results = (data?.items || []).filter((u) => !excludeIds.includes(u._id));
  const selectedIds = new Set(selected.map((u) => u._id));

  const toggle = (user) => {
    if (selectedIds.has(user._id)) onChange(selected.filter((u) => u._id !== user._id));
    else if (selected.length < max) onChange([...selected, user]);
  };

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {selected.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {selected.map((user) => (
                  <motion.span
                    key={user._id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 py-0.5 pr-1 pl-0.5 text-xs font-medium text-fg"
                  >
                    <Avatar src={user.avatarUrl} name={user.fullName} size="xs" />
                    {user.fullName.split(' ')[0]}
                    <button type="button" onClick={() => toggle(user)} className="rounded-full p-0.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label={`Remove ${user.fullName}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchInput value={query} onChange={setQuery} placeholder="Search people by name or @username" autoFocus />

      <div className="max-h-72 min-h-48 overflow-y-auto">
        {isLoading ? (
          <UserListSkeleton />
        ) : isError ? (
          <ErrorState compact message={getErrorMessage(error)} onRetry={refetch} />
        ) : results.length === 0 ? (
          <EmptyState compact icon={SearchX} title="No people found" description={query ? 'Try a different name or username.' : 'Nobody else has joined yet.'} />
        ) : (
          <div className="space-y-0.5">
            {results.map((user) => (
              <UserRow
                key={user._id}
                user={user}
                selected={selectedIds.has(user._id)}
                disabled={!selectedIds.has(user._id) && selected.length >= max}
                onClick={() => toggle(user)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
