import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Flag, Gavel, MessageSquare, ShieldAlert, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { REPORT_ACTIONS, REPORT_REASONS, ReportStatusBadge, Select, UserStatusBadge } from '../../components/admin/AdminUI.jsx';
import { FileCard, ImageGrid, Lightbox } from '../../components/chat/Attachments.jsx';
import RichText from '../../components/chat/RichText.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, SectionHeader } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { cn } from '../../utils/cn.js';
import { formatDateTime, formatTime } from '../../utils/format.js';

function ContextThread({ context, targetUserId }) {
  return (
    <div className="chat-pattern space-y-2 rounded-2xl border border-line p-4">
      {context.messages.map((message) => {
        const isTarget = message._id === context.targetMessageId;
        if (message.type === 'system') {
          return (
            <p key={message._id} className="text-center text-xs text-subtle">
              {message.content}
            </p>
          );
        }
        const fromTarget = message.sender?._id === targetUserId;
        return (
          <div key={message._id} className={cn('flex gap-2', isTarget && 'rounded-xl bg-rose-500/10 p-2 ring-2 ring-rose-500/50')}>
            <Avatar src={message.sender?.avatarUrl} name={message.sender?.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className={cn('font-semibold', fromTarget ? 'text-rose-500' : 'text-fg')}>{message.sender?.fullName}</span>
                <span className="ml-2 text-subtle">{formatTime(message.createdAt)}</span>
                {isTarget && <Badge tone="danger" className="ml-2">Reported</Badge>}
              </p>
              {message.isDeleted ? (
                <p className="text-sm text-subtle italic">{message.moderated ? 'Removed by a moderator' : 'Deleted by the sender'}</p>
              ) : (
                <>
                  {message.content && <RichText text={message.content} className="text-sm text-fg" />}
                  {message.attachments?.length > 0 && <p className="text-xs text-subtle">📎 {message.attachments.length} attachment(s)</p>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionPanel({ report, onDone }) {
  const [status, setStatus] = useState(report.status === 'open' ? 'reviewing' : report.status);
  const [action, setAction] = useState('none');
  const [note, setNote] = useState(report.resolution?.note || '');
  const [saving, setSaving] = useState(false);
  const closed = report.status === 'resolved' || report.status === 'dismissed';

  useEffect(() => {
    if (action !== 'none') setStatus('resolved');
  }, [action]);

  const actionOptions = [
    { value: 'none', label: 'No action' },
    ...(report.targetUser ? [{ value: 'warned', label: 'Warn the user' }] : []),
    ...(report.targetMessage ? [{ value: 'message_removed', label: 'Remove the message' }] : []),
    ...(report.targetUser && report.targetUser.role !== 'admin' && report.targetUser.status !== 'suspended'
      ? [{ value: 'user_suspended', label: 'Suspend the user' }]
      : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      await adminService.updateReport(report._id, { status, action, note: note.trim() });
      toast.success(status === 'resolved' ? 'Report resolved' : status === 'dismissed' ? 'Report dismissed' : 'Marked as reviewing');
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (closed) {
    return (
      <Card className="p-5">
        <SectionHeader title={<span className="flex items-center gap-2"><Gavel className="h-4 w-4 text-brand-400" /> Resolution</span>} />
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Outcome</dt>
            <dd><ReportStatusBadge status={report.status} /></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Action</dt>
            <dd className="font-medium text-fg">{REPORT_ACTIONS[report.resolution?.action] ?? 'No action'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">By</dt>
            <dd className="font-medium text-fg">{report.resolution?.resolvedBy?.fullName ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">When</dt>
            <dd className="text-fg">{formatDateTime(report.resolution?.resolvedAt)}</dd>
          </div>
          {report.resolution?.note && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-muted">“{report.resolution.note}”</p>}
        </dl>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <SectionHeader title={<span className="flex items-center gap-2"><Gavel className="h-4 w-4 text-brand-400" /> Take action</span>} description="Actions are applied immediately and logged." />
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-fg">Action</p>
          <Select label="Action" className="w-full" value={action} onChange={setAction} options={actionOptions} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-fg">Status</p>
          <Select
            label="Status"
            className="w-full"
            value={status}
            onChange={setStatus}
            options={
              action === 'none'
                ? [
                    { value: 'reviewing', label: 'Reviewing' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'dismissed', label: 'Dismissed (no violation)' },
                  ]
                : [{ value: 'resolved', label: 'Resolved' }]
            }
          />
        </div>
        <Textarea label="Moderator note" placeholder="Visible to the user for warnings and suspensions" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        <Button className="w-full" variant={action === 'user_suspended' || action === 'message_removed' ? 'danger' : 'primary'} leftIcon={ShieldAlert} onClick={submit} loading={saving}>
          {action === 'none' ? 'Update report' : `Apply: ${REPORT_ACTIONS[action]}`}
        </Button>
      </div>
    </Card>
  );
}

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lightbox, setLightbox] = useState({ images: [], index: null });
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'report', id], queryFn: () => adminService.report(id) });
  useDocumentTitle('Report · Admin');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  if (isLoading) {
    return (
      <PageContainer wide>
        <Skeleton className="h-40 rounded-2xl" />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </PageContainer>
    );
  }
  if (isError) {
    return (
      <PageContainer>
        {error?.response?.status === 404 ? <EmptyState icon={Flag} title="Report not found" /> : <ErrorState message={getErrorMessage(error)} onRetry={refetch} />}
      </PageContainer>
    );
  }

  const { report, context, relatedReports, targetUserReports } = data;
  const snapshot = report.snapshot || {};
  const TargetIcon = report.targetType === 'message' ? MessageSquare : report.targetType === 'user' ? User : Users;
  const evidenceImages = (snapshot.attachments || []).filter((a) => a.kind === 'image');

  return (
    <PageContainer wide>
      <Button variant="ghost" size="sm" leftIcon={ArrowLeft} onClick={() => navigate('/admin/reports')} className="mb-4">
        Report queue
      </Button>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <TargetIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-fg">
                {REPORT_REASONS[report.reason]} — {report.targetType === 'conversation' ? 'group' : report.targetType}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Reported by{' '}
                <Link to={`/admin/users/${report.reporter?._id}`} className="font-semibold text-accent-fg hover:underline">
                  {report.reporter?.fullName}
                </Link>{' '}
                · {formatDateTime(report.createdAt)}
              </p>
              {report.details && <p className="mt-3 max-w-2xl rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">“{report.details}”</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ReportStatusBadge status={report.status} />
            {relatedReports > 0 && <Badge tone="warning">{relatedReports} other report(s) on this target</Badge>}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <SectionHeader title="Evidence" description="Captured when the report was filed — later edits or deletions can't change it." />
            <div className="mt-4">
              {report.targetType === 'message' && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
                  <p className="mb-2 text-xs font-semibold text-muted">
                    {snapshot.sender?.fullName} · {formatDateTime(snapshot.createdAt)}
                    {snapshot.editedAt && ' · edited'}
                  </p>
                  {snapshot.content && <RichText text={snapshot.content} className="text-fg" />}
                  {snapshot.attachments?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {evidenceImages.length > 0 && (
                        <ImageGrid images={evidenceImages} onOpen={(index) => setLightbox({ images: evidenceImages, index })} />
                      )}
                      {snapshot.attachments.filter((a) => a.kind !== 'image').map((file) => (
                        <FileCard key={file._id} file={file} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {report.targetType === 'user' && (
                <div className="flex items-center gap-4 rounded-2xl border border-line p-4">
                  <Avatar src={snapshot.avatarUrl} name={snapshot.fullName} size="lg" />
                  <div>
                    <p className="font-semibold text-fg">{snapshot.fullName}</p>
                    <p className="text-sm text-subtle">@{snapshot.username}</p>
                    {snapshot.bio && <p className="mt-1 text-sm text-muted">{snapshot.bio}</p>}
                  </div>
                </div>
              )}
              {report.targetType === 'conversation' && (
                <div className="flex items-center gap-4 rounded-2xl border border-line p-4">
                  <Avatar src={snapshot.avatarUrl} name={snapshot.name} size="lg" isGroup rounded="rounded-2xl" />
                  <div>
                    <p className="font-semibold text-fg">{snapshot.name}</p>
                    <p className="text-sm text-subtle">{snapshot.memberCount} members at report time</p>
                    {snapshot.description && <p className="mt-1 text-sm text-muted">{snapshot.description}</p>}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {context && (
            <Card className="p-5">
              <SectionHeader title="Conversation context" description="Up to 5 messages before and after the reported message." />
              <div className="mt-4">
                <ContextThread context={context} targetUserId={report.targetUser?._id} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <ActionPanel report={report} onDone={refresh} />

          {report.targetUser?._id && report.targetUser.fullName && (
            <Card className="p-5">
              <SectionHeader title="Reported user" />
              <div className="mt-4 flex items-center gap-3">
                <Avatar src={report.targetUser.avatarUrl} name={report.targetUser.fullName} online={report.targetUser.isOnline} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">{report.targetUser.fullName}</p>
                  <p className="truncate text-xs text-subtle">@{report.targetUser.username}</p>
                </div>
                <UserStatusBadge status={report.targetUser.status} />
              </div>
              <p className="mt-3 text-xs text-muted">{targetUserReports} total report(s) involving this user.</p>
              <Button as={Link} to={`/admin/users/${report.targetUser._id}`} variant="secondary" size="sm" className="mt-3 w-full" rightIcon={ExternalLink}>
                Open user profile
              </Button>
            </Card>
          )}
          {report.targetConversation?._id && (
            <Button as={Link} to={`/admin/conversations/${report.targetConversation._id}`} variant="secondary" size="sm" className="w-full" rightIcon={ExternalLink}>
              Open conversation details
            </Button>
          )}
        </div>
      </div>
      <Lightbox
        images={lightbox.images}
        index={lightbox.index}
        onClose={() => setLightbox({ images: [], index: null })}
        onIndexChange={(index) => setLightbox((current) => ({ ...current, index }))}
      />
    </PageContainer>
  );
}
