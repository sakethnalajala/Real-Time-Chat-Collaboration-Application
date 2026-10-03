import { useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Lock, MessageSquare, SearchX } from 'lucide-react';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { DataTable, Select } from '../../components/admin/AdminUI.jsx';
import Avatar, { AvatarStack } from '../../components/ui/Avatar.jsx';
import { PageHeader, Pagination } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { SearchInput } from '../../components/ui/Input.jsx';
import { useDebounce, useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { formatNumber, formatRelative } from '../../utils/format.js';

export default function AdminConversationsPage() {
  useDocumentTitle('Conversations · Admin');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q.trim(), 300);
  const params = { q: debounced, type: type || undefined, page, limit: 15 };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'conversations', params],
    queryFn: () => adminService.conversations(params),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      key: 'name',
      label: 'Conversation',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.type === 'group' ? <Avatar src={c.avatarUrl} name={c.name} size="sm" isGroup /> : <AvatarStack users={c.members} max={2} size="sm" />}
          <span className="min-w-0">
            <span className="block max-w-[260px] truncate font-semibold text-fg">{c.name}</span>
            <span className="block text-xs text-subtle">Created by {c.createdBy?.fullName ?? '—'}</span>
          </span>
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (c) => <Badge tone={c.type === 'group' ? 'brand' : 'neutral'}>{c.type === 'group' ? 'Group' : 'Direct'}</Badge> },
    { key: 'members', label: 'Members', render: (c) => <span className="tabular-nums text-muted">{c.memberCount}</span> },
    { key: 'messages', label: 'Messages', render: (c) => <span className="tabular-nums text-muted">{formatNumber(c.messageCount)}</span> },
    { key: 'files', label: 'Files', render: (c) => <span className="tabular-nums text-muted">{formatNumber(c.attachmentCount)}</span> },
    { key: 'reports', label: 'Reports', render: (c) => (c.reportCount ? <Badge tone="danger">{c.reportCount}</Badge> : <span className="text-subtle">0</span>) },
    { key: 'activity', label: 'Last activity', render: (c) => <span className="text-muted">{formatRelative(c.lastActivityAt)}</span> },
  ];

  return (
    <PageContainer wide>
      <PageHeader icon={MessageSquare} title="Conversations" description="Monitor activity across direct chats and groups." />

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
        Private message content is never shown here. Admins see conversation metadata only; content is visible solely through user reports.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full sm:w-80"
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search group name or member"
        />
        <Select
          label="Type"
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All types' },
            { value: 'direct', label: 'Direct' },
            { value: 'group', label: 'Groups' },
          ]}
        />
      </div>

      <div className={`mt-4 transition-opacity ${isFetching && !isLoading ? 'opacity-70' : ''}`}>
        {isLoading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              onRowClick={(c) => navigate(`/admin/conversations/${c._id}`)}
              empty={<EmptyState icon={SearchX} title="No conversations found" />}
            />
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
