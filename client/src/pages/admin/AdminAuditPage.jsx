import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { DataTable } from '../../components/admin/AdminUI.jsx';
import { PageHeader, Pagination } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

const ACTION_TONES = {
  'user.suspend': 'danger',
  'user.reactivate': 'success',
  'user.force_logout': 'warning',
  'user.update_profile': 'info',
  'message.remove': 'danger',
};

const targetLink = (log) => {
  if (log.targetType === 'user') return `/admin/users/${log.targetId}`;
  if (log.targetType === 'report') return `/admin/reports/${log.targetId}`;
  if (log.targetType === 'conversation') return `/admin/conversations/${log.targetId}`;
  if (log.targetType === 'message' && log.meta?.conversation) return `/admin/conversations/${log.meta.conversation}`;
  return null;
};

export default function AdminAuditPage() {
  useDocumentTitle('Audit log · Admin');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => adminService.auditLogs({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'when', label: 'When', render: (log) => <span className="whitespace-nowrap text-muted">{formatDateTime(log.createdAt)}</span> },
    { key: 'admin', label: 'Admin', render: (log) => <span className="font-medium text-fg">{log.actor?.fullName ?? '—'}</span> },
    {
      key: 'action',
      label: 'Action',
      render: (log) => <Badge tone={ACTION_TONES[log.action] ?? (log.action.startsWith('report') ? 'brand' : 'neutral')}>{log.action}</Badge>,
    },
    {
      key: 'target',
      label: 'Target',
      render: (log) => {
        const to = targetLink(log);
        return to ? (
          <Link to={to} onClick={(e) => e.stopPropagation()} className="font-medium text-accent-fg hover:underline">
            {log.targetType}
          </Link>
        ) : (
          <span className="text-muted">{log.targetType}</span>
        );
      },
    },
    {
      key: 'details',
      label: 'Details',
      render: (log) => (
        <span className="line-clamp-1 max-w-xs text-muted">
          {log.meta?.reason || log.meta?.note || (log.meta?.action && log.meta.action !== 'none' ? log.meta.action : '') || '—'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer wide>
      <PageHeader icon={ScrollText} title="Audit log" description="Every administrative action, newest first." />
      <div className="mt-6">
        {isLoading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} empty={<EmptyState icon={ScrollText} title="No admin actions yet" />} />
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
