import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flag, MessageSquare, ShieldCheck, User, Users } from 'lucide-react';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { REPORT_REASONS, ReportStatusBadge, Select } from '../../components/admin/AdminUI.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { Card, PageHeader, Pagination, Tabs } from '../../components/ui/Controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { formatRelative } from '../../utils/format.js';

const TARGET_ICONS = { message: MessageSquare, user: User, conversation: Users };

export default function AdminReportsPage() {
  useDocumentTitle('Reports · Admin');
  const [status, setStatus] = useState('open');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const params = { status: status || undefined, targetType: targetType || undefined, page, limit: 12 };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => adminService.reports(params),
    placeholderData: keepPreviousData,
  });
  const counts = data?.counts ?? {};

  return (
    <PageContainer wide>
      <PageHeader icon={Flag} title="Reports" description="Review user reports and take moderation action." />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Tabs
          layoutId="report-status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          tabs={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'reviewing', label: 'Reviewing', count: counts.reviewing },
            { value: 'resolved', label: 'Resolved' },
            { value: 'dismissed', label: 'Dismissed' },
            { value: '', label: 'All' },
          ]}
        />
        <Select
          label="Target"
          value={targetType}
          onChange={(value) => {
            setTargetType(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All targets' },
            { value: 'message', label: 'Messages' },
            { value: 'user', label: 'Users' },
            { value: 'conversation', label: 'Groups' },
          ]}
        />
      </div>

      <div className={`mt-4 transition-opacity ${isFetching && !isLoading ? 'opacity-70' : ''}`}>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={status === 'open' ? 'Inbox zero 🎉' : 'No reports here'}
            description={status === 'open' ? 'There are no open reports right now.' : 'Try a different filter.'}
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.items.map((report, index) => {
                const Icon = TARGET_ICONS[report.targetType] ?? Flag;
                return (
                  <motion.div key={report._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                    <Link to={`/admin/reports/${report._id}`}>
                      <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:border-brand-500/30">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-fg">
                            {REPORT_REASONS[report.reason]}
                            <span className="font-normal text-muted"> · reported {report.targetType === 'conversation' ? 'group' : report.targetType}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                            {report.targetType === 'message'
                              ? `"${report.snapshot?.content || 'Attachment'}"`
                              : report.targetType === 'user'
                                ? `${report.snapshot?.fullName} (@${report.snapshot?.username})`
                                : report.snapshot?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar src={report.reporter?.avatarUrl} name={report.reporter?.fullName} size="xs" />
                          <span className="text-xs text-subtle">{report.reporter?.fullName} · {formatRelative(report.createdAt)}</span>
                        </div>
                        <ReportStatusBadge status={report.status} />
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
