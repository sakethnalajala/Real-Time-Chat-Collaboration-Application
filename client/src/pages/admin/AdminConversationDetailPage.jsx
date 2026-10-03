import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Crown, Flag, Lock, MessageSquare, MessageSquareOff, Paperclip, Shield, Users } from 'lucide-react';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { REPORT_REASONS, ReportStatusBadge, StatTile } from '../../components/admin/AdminUI.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, SectionHeader } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { formatDateTime, formatRelative } from '../../utils/format.js';

export default function AdminConversationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'conversation', id], queryFn: () => adminService.conversation(id) });
  useDocumentTitle(data ? `${data.conversation.name} · Admin` : 'Conversation · Admin');

  return (
    <PageContainer wide>
      <Button variant="ghost" size="sm" leftIcon={ArrowLeft} onClick={() => navigate('/admin/conversations')} className="mb-4">
        All conversations
      </Button>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        error?.response?.status === 404 ? (
          <EmptyState icon={MessageSquareOff} title="Conversation not found" />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        )
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar src={data.conversation.avatarUrl} name={data.conversation.name} size="xl" isGroup={data.conversation.type === 'group'} rounded="rounded-2xl" />
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-fg">
                  {data.conversation.name}
                  <Badge tone={data.conversation.type === 'group' ? 'brand' : 'neutral'}>{data.conversation.type === 'group' ? 'Group' : 'Direct'}</Badge>
                </h1>
                {data.conversation.description && <p className="mt-1 text-sm text-muted">{data.conversation.description}</p>}
                <p className="mt-1 text-xs text-subtle">
                  Created {formatDateTime(data.conversation.createdAt)} by {data.conversation.createdBy?.fullName ?? '—'} · last activity{' '}
                  {formatRelative(data.conversation.lastActivityAt)}
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={MessageSquare} label="Messages" value={data.stats.messageCount} hint={`${data.stats.messages7d} in the last 7 days`} />
            <StatTile icon={Users} label="Members" value={data.conversation.members.length} />
            <StatTile icon={Paperclip} label="Shared files" value={data.stats.attachmentCount} />
            <StatTile icon={Flag} label="Reports" value={data.stats.reportCount} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHeader title="Members" />
              <div className="mt-3 space-y-1">
                {data.conversation.members.map((member) => (
                  <Link key={member._id} to={`/admin/users/${member._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                    <Avatar src={member.avatarUrl} name={member.fullName} size="sm" online={member.isOnline} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{member.fullName}</span>
                      <span className="block text-xs text-subtle">Joined {formatRelative(member.joinedAt)}</span>
                    </span>
                    {member.role === 'owner' && <Badge tone="warning"><Crown className="h-3 w-3" /> Owner</Badge>}
                    {member.role === 'admin' && <Badge tone="brand"><Shield className="h-3 w-3" /> Admin</Badge>}
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="Reports in this conversation" />
              <div className="mt-3 space-y-1">
                {data.reports.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">No reports filed here.</p>
                ) : (
                  data.reports.map((report) => (
                    <Link key={report._id} to={`/admin/reports/${report._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                      <Flag className="h-4 w-4 text-rose-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{REPORT_REASONS[report.reason]} · {report.targetType}</span>
                        <span className="block text-xs text-subtle">{formatRelative(report.createdAt)}</span>
                      </span>
                      <ReportStatusBadge status={report.status} />
                    </Link>
                  ))
                )}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                Message content stays private. Open a report to see the reported message and its surrounding context.
              </p>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
