import { useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchX, UsersRound } from 'lucide-react';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { DataTable, RoleBadge, Select, UserStatusBadge } from '../../components/admin/AdminUI.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { PageHeader, Pagination } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { SearchInput } from '../../components/ui/Input.jsx';
import { useDebounce, useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { usePresence } from '../../utils/stores.js';
import { formatDate, formatRelative } from '../../utils/format.js';

function UserCell({ user }) {
  const presence = usePresence(user);
  return (
    <div className="flex items-center gap-3">
      <Avatar src={user.avatarUrl} name={user.fullName} size="sm" online={presence.isOnline} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
          {user.fullName}
          {user.isDemo && <Badge tone="warning">Demo</Badge>}
        </p>
        <p className="truncate text-xs text-subtle">@{user.username}</p>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  useDocumentTitle('Users · Admin');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q.trim(), 300);

  const params = { q: debounced, role: role || undefined, status: status || undefined, page, limit: 15 };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.users(params),
    placeholderData: keepPreviousData,
  });

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const columns = [
    { key: 'user', label: 'User', render: (u) => <UserCell user={u} /> },
    { key: 'email', label: 'Email', render: (u) => <span className="text-muted">{u.email}</span> },
    { key: 'role', label: 'Role', render: (u) => <RoleBadge role={u.role} /> },
    { key: 'status', label: 'Status', render: (u) => <UserStatusBadge status={u.status} /> },
    { key: 'joined', label: 'Joined', render: (u) => <span className="text-muted">{formatDate(u.createdAt)}</span> },
    { key: 'seen', label: 'Last seen', render: (u) => <span className="text-muted">{u.isOnline ? 'Online' : formatRelative(u.lastSeen)}</span> },
  ];

  return (
    <PageContainer wide>
      <PageHeader icon={UsersRound} title="Users" description={data ? `${data.pagination.total} accounts` : 'Manage accounts and access'} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchInput className="w-full sm:w-80" value={q} onChange={resetPage(setQ)} placeholder="Search name, username or email" />
        <Select
          label="Role"
          value={role}
          onChange={resetPage(setRole)}
          options={[
            { value: '', label: 'All roles' },
            { value: 'user', label: 'Users' },
            { value: 'admin', label: 'Admins' },
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={resetPage(setStatus)}
          options={[
            { value: '', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
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
              onRowClick={(u) => navigate(`/admin/users/${u._id}`)}
              empty={<EmptyState icon={SearchX} title="No users match these filters" />}
            />
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
