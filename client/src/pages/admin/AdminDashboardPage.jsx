import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Flag, Gauge, HardDrive, Image, MessageSquare, MessagesSquare, Paperclip, RefreshCw, Type, UserPlus, Users, UserX, Wifi } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import { ChartCard, ReportStatusBadge, REPORT_REASONS, StatTile, UserStatusBadge } from '../../components/admin/AdminUI.jsx';
import { AreaTrend, ColumnTrend, ProportionList } from '../../components/admin/Charts.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader } from '../../components/ui/Controls.jsx';
import { Badge, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { formatNumber, formatRelative, pluralize } from '../../utils/format.js';

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function AdminDashboardPage() {
  useDocumentTitle('Admin · Nebula Chat');
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminService.stats,
    refetchInterval: 60_000,
  });

  const totals = data?.totals;
  const sum = (series) => series.reduce((total, d) => total + d.count, 0);
  const tableFor = (series, label) => ({
    columns: ['Date', label],
    rows: series.map((d) => [format(parseISO(d.date), 'EEE, MMM d'), formatNumber(d.count)]),
  });

  return (
    <PageContainer wide>
      <PageHeader
        icon={Gauge}
        title="Admin overview"
        description="Platform health, activity and moderation at a glance."
        action={
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className={`mt-6 space-y-4 transition-opacity ${isFetching ? 'opacity-80' : ''}`}>
          <motion.div variants={fade} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile icon={Users} label="Total users" value={totals.users} hint={`+${totals.newUsers7d} in the last 7 days`} to="/admin/users" />
            <StatTile icon={Wifi} label="Online now" value={totals.onlineNow} hint={pluralize(totals.activeSockets, 'open connection')} live />
            <StatTile icon={MessageSquare} label="Messages today" value={totals.messagesToday} hint={`${formatNumber(totals.messages)} all time`} />
            <StatTile icon={MessagesSquare} label="Conversations" value={totals.conversations} hint={`${pluralize(totals.groups, 'group')} · ${totals.activeConversations7d} active this week`} to="/admin/conversations" />
            <StatTile icon={Flag} label="Open reports" value={totals.openReports} hint="Open + reviewing" to="/admin/reports" />
            <StatTile icon={UserX} label="Suspended" value={totals.suspendedUsers} hint="Accounts restricted" to="/admin/users" />
          </motion.div>

          <motion.div variants={fade} className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Messages per day"
              description="Last 14 days, excluding system messages"
              headline={<span className="text-sm text-muted"><span className="font-semibold text-fg">{formatNumber(sum(data.series.messages))}</span> total</span>}
              table={tableFor(data.series.messages, 'Messages')}
            >
              <AreaTrend data={data.series.messages} />
            </ChartCard>
            <ChartCard
              title="New sign-ups per day"
              description="Last 14 days"
              headline={<span className="text-sm text-muted"><span className="font-semibold text-fg">{formatNumber(sum(data.series.signups))}</span> total</span>}
              table={tableFor(data.series.signups, 'Sign-ups')}
            >
              <ColumnTrend data={data.series.signups} />
            </ChartCard>
          </motion.div>

          <motion.div variants={fade} className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <SectionHeader title="Message mix" description="All-time share by type" />
              <div className="mt-5">
                <ProportionList
                  items={[
                    { label: 'Text', value: data.messageTypes.text || 0, icon: Type },
                    { label: 'Images', value: data.messageTypes.image || 0, icon: Image },
                    { label: 'Files', value: data.messageTypes.file || 0, icon: Paperclip },
                  ]}
                />
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
                <HardDrive className="h-5 w-5 text-brand-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">File storage</p>
                  <p className="text-xs text-muted">{data.storage.enabled ? `Driver: ${data.storage.driver}` : 'Uploads disabled — set the CLOUDINARY_* variables'}</p>
                </div>
                <Badge tone={data.storage.enabled ? 'success' : 'warning'} dot>
                  {data.storage.enabled ? 'Healthy' : 'Off'}
                </Badge>
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <SectionHeader
                title="Latest reports"
                action={
                  <Button as={Link} to="/admin/reports" variant="ghost" size="sm" rightIcon={ArrowRight}>
                    Review queue
                  </Button>
                }
              />
              <div className="mt-3 space-y-1">
                {data.recentReports.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">No reports yet — the community is behaving. 🎉</p>
                ) : (
                  data.recentReports.map((report) => (
                    <Link key={report._id} to={`/admin/reports/${report._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                        <Flag className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {REPORT_REASONS[report.reason]} · {report.targetType}
                          {report.targetUser?.fullName ? ` by ${report.targetUser.fullName}` : ''}
                        </p>
                        <p className="truncate text-xs text-subtle">
                          Reported by {report.reporter?.fullName ?? 'a user'} · {formatRelative(report.createdAt)}
                        </p>
                      </div>
                      <ReportStatusBadge status={report.status} />
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={fade}>
            <Card className="p-5">
              <SectionHeader
                title="Newest members"
                action={
                  <Button as={Link} to="/admin/users" variant="ghost" size="sm" rightIcon={ArrowRight}>
                    All users
                  </Button>
                }
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.recentUsers.map((user) => (
                  <Link key={user._id} to={`/admin/users/${user._id}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-brand-500/30">
                    <Avatar src={user.avatarUrl} name={user.fullName} online={user.isOnline} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{user.fullName}</p>
                      <p className="truncate text-xs text-subtle">Joined {formatRelative(user.createdAt)}</p>
                    </div>
                    {user.status === 'suspended' ? <UserStatusBadge status={user.status} /> : <UserPlus className="h-4 w-4 text-subtle" />}
                  </Link>
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </PageContainer>
  );
}
