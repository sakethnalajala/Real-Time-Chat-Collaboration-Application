import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CalendarDays, Check, Copy, Flag, KeyRound, LogOut, Mail, MessageSquare, PenLine, ScrollText, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { REPORT_REASONS, ReportStatusBadge, RoleBadge, StatTile, UserStatusBadge } from '../../components/admin/AdminUI.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, SectionHeader, Switch } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage, getFieldErrors } from '../../services/api.js';
import { formatDateTime, formatRelative } from '../../utils/format.js';

function SuspendModal({ open, onClose, user, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await adminService.setStatus(user._id, 'suspended', reason.trim());
      toast.success(`${user.fullName} has been suspended`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={`Suspend ${user.fullName}?`}
      description="They are signed out everywhere immediately and can't sign in until reactivated."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" leftIcon={Ban} onClick={submit} loading={saving} disabled={!reason.trim()}>
            Suspend account
          </Button>
        </>
      }
    >
      <Textarea label="Reason (shown to the user)" placeholder="e.g. Repeated spam in group chats" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function ModerateProfileModal({ open, onClose, user, onDone }) {
  const [form, setForm] = useState({ fullName: '', username: '', bio: '', removeAvatar: false });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ fullName: user.fullName, username: user.username, bio: user.bio || '', removeAvatar: false });
      setErrors({});
    }
  }, [open, user]);

  const submit = async () => {
    setSaving(true);
    try {
      await adminService.updateUser(user._id, {
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim(),
        removeAvatar: form.removeAvatar || undefined,
      });
      toast.success('Profile updated');
      onDone();
      onClose();
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Moderate profile"
      description="Edit public profile content that breaks the guidelines. Changes are logged."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} />
        <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} error={errors.username} />
        <Textarea label="Bio" value={form.bio} maxLength={160} onChange={(e) => setForm({ ...form, bio: e.target.value })} error={errors.bio} />
        {user.avatarUrl && (
          <Switch id="remove-avatar" label="Remove profile picture" checked={form.removeAvatar} onChange={(value) => setForm({ ...form, removeAvatar: value })} />
        )}
      </div>
    </Modal>
  );
}

/**
 * Email-free password reset: the admin creates a single-use link and shares it with the user
 * through a channel they trust. The link is shown once and is not stored anywhere readable.
 */
function ResetLinkModal({ open, onClose, user, onDone }) {
  const [state, setState] = useState({ status: 'idle', link: null, error: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setState({ status: 'idle', link: null, error: null });
      setCopied(false);
    }
  }, [open]);

  const create = async () => {
    setState({ status: 'loading', link: null, error: null });
    try {
      const link = await adminService.createResetLink(user._id);
      setState({ status: 'done', link, error: null });
      onDone();
    } catch (error) {
      setState({ status: 'error', link: null, error: getErrorMessage(error) });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.link.resetUrl);
      setCopied(true);
      toast.success('Reset link copied');
    } catch {
      toast.error('Copy is not available — select the link and copy it manually');
    }
  };

  return (
    <Modal
      open={open}
      onClose={state.status === 'loading' ? undefined : onClose}
      title="Password reset link"
      description={`Create a single-use link ${user.fullName} can use to choose a new password. No email is sent.`}
      footer={
        state.status === 'done' ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={state.status === 'loading'}>
              Cancel
            </Button>
            <Button leftIcon={KeyRound} onClick={create} loading={state.status === 'loading'}>
              Create link
            </Button>
          </>
        )
      }
    >
      {state.status === 'done' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 p-2 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={state.link.resetUrl}>
              {state.link.resetUrl}
            </code>
            <Button size="sm" variant="secondary" leftIcon={copied ? Check : Copy} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>• Share it with {user.fullName.split(' ')[0]} directly (chat, phone, in person).</li>
            <li>• It works once and expires {formatRelative(state.link.expiresAt)} ({formatDateTime(state.link.expiresAt)}).</li>
            <li>• After they reset, all of their existing sessions are signed out.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-muted">
          <p>
            This server doesn't send email, so password resets are handled by administrators. The link appears here once — copy it and
            send it to the user yourself.
          </p>
          {state.status === 'error' && (
            <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-rose-500">
              {state.error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminService.user(id) });
  useDocumentTitle(data ? `${data.user.fullName} · Admin` : 'User · Admin');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const reactivate = async () => {
    setBusy(true);
    try {
      await adminService.setStatus(id, 'active');
      toast.success('Account reactivated');
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forceLogout = async () => {
    setBusy(true);
    try {
      await adminService.forceLogout(id);
      toast.success('All sessions were signed out');
      setModal(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer wide>
        <Skeleton className="h-48 rounded-2xl" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        {error?.response?.status === 404 ? (
          <EmptyState icon={UserX} title="User not found" action={<Button onClick={() => navigate('/admin/users')}>Back to users</Button>} />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        )}
      </PageContainer>
    );
  }

  const { user, stats, recentReports, auditTrail } = data;
  const isSelf = user._id === me._id;
  const isAdminTarget = user.role === 'admin';

  return (
    <PageContainer wide>
      <Button variant="ghost" size="sm" leftIcon={ArrowLeft} onClick={() => navigate('/admin/users')} className="mb-4">
        All users
      </Button>

      <Card className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={user.avatarUrl} name={user.fullName} size="2xl" online={user.isOnline} />
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-fg">
                {user.fullName}
                <RoleBadge role={user.role} />
                <UserStatusBadge status={user.status} />
                {user.isDemo && <Badge tone="warning">Demo</Badge>}
              </h1>
              <p className="text-subtle">@{user.username}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {user.email}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Joined {formatDateTime(user.createdAt)}</span>
                <span>{user.isOnline ? 'Online now' : `Last seen ${formatRelative(user.lastSeen)}`}</span>
              </div>
              {user.status === 'suspended' && user.statusReason && (
                <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                  Suspended {formatRelative(user.statusChangedAt)}: {user.statusReason}
                </p>
              )}
            </div>
          </div>

          {!isSelf && (
            <div className="flex flex-wrap gap-2">
              {!isAdminTarget && <Button variant="secondary" size="sm" leftIcon={PenLine} onClick={() => setModal('moderate')}>Moderate profile</Button>}
              {!isAdminTarget && !user.isDemo && user.status === 'active' && (
                <Button variant="secondary" size="sm" leftIcon={KeyRound} onClick={() => setModal('reset')}>
                  Reset link
                </Button>
              )}
              <Button variant="secondary" size="sm" leftIcon={LogOut} onClick={() => setModal('logout')} disabled={isAdminTarget}>
                Force sign-out
              </Button>
              {!isAdminTarget &&
                (user.status === 'suspended' ? (
                  <Button variant="success" size="sm" leftIcon={UserCheck} onClick={reactivate} loading={busy}>
                    Reactivate
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" leftIcon={Ban} onClick={() => setModal('suspend')}>
                    Suspend
                  </Button>
                ))}
            </div>
          )}
          {isSelf && (
            <Badge tone="brand">
              <ShieldCheck className="h-3 w-3" /> This is you
            </Badge>
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={MessageSquare} label="Messages sent" value={stats.messages} />
        <StatTile icon={Users} label="Conversations" value={stats.conversations} hint={`${stats.groups} groups · ${stats.directConversations} direct`} />
        <StatTile icon={Flag} label="Reports against" value={stats.reportsAgainst} hint={`${stats.reportsFiled} filed by them`} />
        <StatTile icon={ShieldCheck} label="Active sessions" value={stats.activeSessions} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Reports about this user" />
          <div className="mt-3 space-y-1">
            {recentReports.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No reports against this user.</p>
            ) : (
              recentReports.map((report) => (
                <Link key={report._id} to={`/admin/reports/${report._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                  <Flag className="h-4 w-4 text-rose-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{REPORT_REASONS[report.reason]} · {report.targetType}</span>
                    <span className="block text-xs text-subtle">{formatRelative(report.createdAt)} by {report.reporter?.fullName}</span>
                  </span>
                  <ReportStatusBadge status={report.status} />
                </Link>
              ))
            )}
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title={<span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-brand-400" /> Moderation history</span>} />
          <div className="mt-3 space-y-2">
            {auditTrail.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No moderation actions recorded.</p>
            ) : (
              auditTrail.map((entry) => (
                <div key={entry._id} className="rounded-xl border border-line px-3 py-2">
                  <p className="text-sm font-medium text-fg">{entry.action.replace('.', ' · ').replace(/_/g, ' ')}</p>
                  <p className="text-xs text-subtle">
                    {entry.actor?.fullName ?? 'Unknown'} · {formatDateTime(entry.createdAt)}
                    {entry.meta?.reason ? ` · "${entry.meta.reason}"` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <SuspendModal open={modal === 'suspend'} onClose={() => setModal(null)} user={user} onDone={refresh} />
      <ModerateProfileModal open={modal === 'moderate'} onClose={() => setModal(null)} user={user} onDone={refresh} />
      <ResetLinkModal open={modal === 'reset'} onClose={() => setModal(null)} user={user} onDone={refresh} />
      <ConfirmDialog
        open={modal === 'logout'}
        onClose={() => setModal(null)}
        onConfirm={forceLogout}
        loading={busy}
        title={`Sign ${user.fullName} out everywhere?`}
        description="All of their sessions end immediately. They can sign in again."
        confirmLabel="Force sign-out"
      />
    </PageContainer>
  );
}
