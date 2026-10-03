import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { messageService, reportService } from '../../services/index.js';
import { getErrorCode, getErrorMessage } from '../../services/api.js';
import { cn } from '../../utils/cn.js';
import { formatDateTime } from '../../utils/format.js';
import Avatar from '../ui/Avatar.jsx';
import Button from '../ui/Button.jsx';
import { ErrorState, Skeleton } from '../ui/Feedback.jsx';
import { Textarea } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import RichText from './RichText.jsx';

const STATUS_META = {
  read: { label: 'Read', icon: CheckCheck, className: 'text-brand-400' },
  delivered: { label: 'Delivered', icon: CheckCheck, className: 'text-muted' },
  sent: { label: 'Sent', icon: Check, className: 'text-subtle' },
};

/** Per-member delivery/read status for one of my messages. */
export function MessageInfoModal({ message, onClose }) {
  const open = Boolean(message);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['message-info', message?._id],
    queryFn: () => messageService.info(message._id),
    enabled: open,
    staleTime: 0,
  });

  const groups = ['read', 'delivered', 'sent'].map((status) => ({
    status,
    receipts: data?.receipts?.filter((r) => r.status === status) ?? [],
  }));

  return (
    <Modal open={open} onClose={onClose} title="Message info">
      {message && (
        <div className="mb-5 rounded-2xl brand-gradient px-4 py-3 text-white shadow-lg">
          {message.content ? <RichText text={message.content} mine /> : <p className="text-sm italic opacity-80">{message.attachments?.length} attachment(s)</p>}
          <p className="mt-1 text-right text-[11px] text-white/70">{formatDateTime(message.createdAt)}</p>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <ErrorState compact message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        <div className="space-y-5">
          {groups.map(({ status, receipts }) => {
            const meta = STATUS_META[status];
            if (!receipts.length) return null;
            return (
              <div key={status}>
                <p className={cn('mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase', meta.className)}>
                  <meta.icon className="h-4 w-4" /> {meta.label} · {receipts.length}
                </p>
                <div className="space-y-1">
                  {receipts.map((receipt) => (
                    <div key={receipt.user._id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                      <Avatar src={receipt.user.avatarUrl} name={receipt.user.fullName} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{receipt.user.fullName}</span>
                      <span className="text-xs text-subtle">
                        {status === 'read' ? formatDateTime(receipt.readAt) : status === 'delivered' ? formatDateTime(receipt.deliveredAt) : 'Not delivered yet'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {data?.receipts?.length === 0 && <p className="text-center text-sm text-muted">No recipients for this message.</p>}
        </div>
      )}
    </Modal>
  );
}

const REASONS = [
  { value: 'spam', label: 'Spam', description: 'Unwanted ads, scams or repetitive messages' },
  { value: 'harassment', label: 'Harassment or bullying', description: 'Targeted abuse, threats or intimidation' },
  { value: 'hate_speech', label: 'Hate speech', description: 'Attacks based on identity or protected traits' },
  { value: 'inappropriate_content', label: 'Inappropriate content', description: 'Explicit, violent or disturbing material' },
  { value: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else', description: 'Tell us what happened below' },
];

/** target: { type: 'user' | 'message' | 'conversation', id, label } */
export function ReportModal({ target, onClose }) {
  const open = Boolean(target);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await reportService.create({ targetType: target.type, targetId: target.id, reason, details: details.trim() });
      toast.success('Report submitted. Our moderators will review it shortly.');
      onClose();
    } catch (error) {
      if (getErrorCode(error) === 'REPORT_EXISTS') {
        toast.info(getErrorMessage(error));
        onClose();
      } else {
        toast.error(getErrorMessage(error, 'Could not submit the report'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={`Report ${target?.type === 'conversation' ? 'group' : target?.type ?? ''}`}
      description={target?.label}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" leftIcon={Flag} onClick={submit} loading={submitting} disabled={!reason || (reason === 'other' && !details.trim())}>
            Submit report
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-fg">Why are you reporting this?</legend>
        {REASONS.map((item) => (
          <label
            key={item.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
              reason === item.value ? 'border-brand-500 bg-brand-500/8' : 'border-line hover:border-line-strong'
            )}
          >
            <input type="radio" name="reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="mt-0.5 accent-violet-600" />
            <span>
              <span className="block text-sm font-semibold text-fg">{item.label}</span>
              <span className="block text-xs text-muted">{item.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Textarea
        className="mt-4"
        label="Additional details"
        placeholder="Anything that helps our moderators understand the situation"
        value={details}
        maxLength={1000}
        onChange={(e) => setDetails(e.target.value)}
      />
      <p className="mt-3 text-xs text-subtle">Reports are confidential. The reported person is not told who reported them.</p>
    </Modal>
  );
}
