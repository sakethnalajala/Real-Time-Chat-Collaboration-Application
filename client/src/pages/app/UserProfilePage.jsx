import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Flag, Mail, MessageSquare, Pencil, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Controls.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ReportModal } from '../../components/chat/MessageModals.jsx';
import { useOpenDirectChat } from '../../components/chat/NewChatModal.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { userService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { usePresence } from '../../utils/stores.js';
import { formatDate, formatLastSeen } from '../../utils/format.js';

export default function UserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const openDirect = useOpenDirectChat();
  const [reportOpen, setReportOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => (await userService.getProfile(id)).user,
  });
  const presence = usePresence(data);
  useDocumentTitle(data ? `${data.fullName} · Nebula Chat` : 'Profile · Nebula Chat');

  const message = async () => {
    setOpening(true);
    try {
      if (data.directConversationId) navigate(`/chats/${data.directConversationId}`);
      else await openDirect(data._id);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setOpening(false);
    }
  };

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" leftIcon={ArrowLeft} onClick={() => navigate(-1)} className="mb-4">
        Back
      </Button>
      {isLoading ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </Card>
      ) : isError ? (
        error?.response?.status === 404 ? (
          <EmptyState icon={UserX} title="User not found" description="This account doesn't exist or is no longer available." />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        )
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="relative overflow-hidden">
            <div className="h-32 bg-linear-to-r from-brand-800 via-brand-600 to-fuchsia-600 sm:h-40" />
            <div className="px-6 pb-6">
              <div className="-mt-16 flex flex-col items-center text-center sm:-mt-20">
                <Avatar src={data.avatarUrl} name={data.fullName} size="3xl" online={presence.isOnline} className="rounded-full ring-4 ring-surface" />
                <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-fg">
                  {data.fullName}
                  {data.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                </h1>
                <p className="text-subtle">@{data.username}</p>
                <p className={presence.isOnline ? 'mt-1 text-sm font-medium text-emerald-500' : 'mt-1 text-sm text-subtle'}>
                  {presence.isOnline ? 'Online now' : formatLastSeen(presence.lastSeen)}
                </p>
                {data.bio && <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">{data.bio}</p>}

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {data.isSelf ? (
                    <Button as={Link} to="/profile" leftIcon={Pencil}>
                      Edit your profile
                    </Button>
                  ) : (
                    <>
                      <Button leftIcon={MessageSquare} onClick={message} loading={opening}>
                        Message
                      </Button>
                      <Button variant="secondary" leftIcon={Flag} onClick={() => setReportOpen(true)}>
                        Report
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-fg">About</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-3 text-muted">
                  <CalendarDays className="h-4 w-4 text-brand-400" /> Joined {formatDate(data.createdAt, 'MMMM yyyy')}
                </div>
                {data.email && (
                  <div className="flex items-center gap-3 text-muted">
                    <Mail className="h-4 w-4 text-brand-400" /> {data.email}
                  </div>
                )}
              </dl>
            </Card>
            {!data.isSelf && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Users className="h-4 w-4 text-brand-400" /> Groups in common · {data.sharedGroups.length}
                </h2>
                {data.sharedGroups.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">You don't share any groups yet.</p>
                ) : (
                  <div className="mt-3 space-y-1">
                    {data.sharedGroups.map((group) => (
                      <Link key={group._id} to={`/chats/${group._id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
                        <Avatar src={group.avatarUrl} name={group.name} size="sm" isGroup />
                        <span className="truncate text-sm font-medium text-fg">{group.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </motion.div>
      )}
      <ReportModal target={reportOpen && data ? { type: 'user', id: data._id, label: data.fullName } : null} onClose={() => setReportOpen(false)} />
    </PageContainer>
  );
}
