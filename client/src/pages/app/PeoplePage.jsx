import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageSquare, SearchX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, PageHeader } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { SearchInput } from '../../components/ui/Input.jsx';
import { useOpenDirectChat } from '../../components/chat/NewChatModal.jsx';
import { useDebounce, useDocumentTitle } from '../../hooks/useUtils.js';
import { userService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { usePresence } from '../../utils/stores.js';
import { formatLastSeen } from '../../utils/format.js';

function PersonCard({ person, index }) {
  const presence = usePresence(person);
  const openDirect = useOpenDirectChat();
  const [opening, setOpening] = useState(false);

  const message = async () => {
    setOpening(true);
    try {
      await openDirect(person._id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not open the conversation'));
      setOpening(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.03 }}>
      <Card className="flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-900/10">
        <Link to={`/users/${person._id}`} className="flex items-center gap-3">
          <Avatar src={person.avatarUrl} name={person.fullName} size="lg" online={presence.isOnline} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
              {person.fullName}
              {person.role === 'admin' && <Badge tone="brand">Admin</Badge>}
            </p>
            <p className="truncate text-sm text-subtle">@{person.username}</p>
          </div>
        </Link>
        <p className="mt-3 line-clamp-2 min-h-10 flex-1 text-sm text-muted">{person.bio || 'No bio yet.'}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className={presence.isOnline ? 'text-xs font-medium text-emerald-500' : 'text-xs text-subtle'}>
            {presence.isOnline ? 'Online' : formatLastSeen(presence.lastSeen)}
          </span>
          <Button size="sm" leftIcon={MessageSquare} onClick={message} loading={opening}>
            Message
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function PeoplePage() {
  useDocumentTitle('People · Nebula Chat');
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);

  const search = useInfiniteQuery({
    queryKey: ['users', 'directory', debounced],
    queryFn: ({ pageParam }) => userService.search({ q: debounced, page: pageParam, limit: 24 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const people = search.data?.pages.flatMap((p) => p.items) ?? [];
  const total = search.data?.pages[0]?.pagination.total ?? 0;

  return (
    <PageContainer wide>
      <PageHeader icon={Users} title="People" description="Discover teammates and start a conversation." />
      <SearchInput className="mt-6 max-w-xl" value={query} onChange={setQuery} placeholder="Search by name or @username" autoFocus />
      {!search.isLoading && !search.isError && (
        <p className="mt-3 text-xs text-subtle">
          {total} {total === 1 ? 'person' : 'people'}
          {debounced ? ` matching "${debounced}"` : ''}
        </p>
      )}

      <div className="mt-4">
        {search.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : search.isError ? (
          <ErrorState message={getErrorMessage(search.error)} onRetry={() => search.refetch()} />
        ) : people.length === 0 ? (
          <EmptyState icon={SearchX} title="No people found" description={debounced ? 'Try a different name or username.' : 'Nobody else has joined yet — invite your team!'} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((person, index) => (
                <PersonCard key={person._id} person={person} index={index} />
              ))}
            </div>
            {search.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={() => search.fetchNextPage()} loading={search.isFetchingNextPage}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
