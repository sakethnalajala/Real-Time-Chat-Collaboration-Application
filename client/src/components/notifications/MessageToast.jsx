import { toast } from 'sonner';
import Avatar from '../ui/Avatar.jsx';

/** In-app toast for an incoming message (click to open the conversation). */
export default function MessageToast({ toastId, notification, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => {
        toast.dismiss(toastId);
        onOpen();
      }}
      className="flex w-[340px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-line bg-elevated p-3.5 text-left shadow-2xl shadow-black/30 transition hover:border-brand-500/40"
    >
      <Avatar src={notification.actor?.avatarUrl} name={notification.actor?.fullName || notification.title} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-fg">{notification.title}</span>
          {notification.count > 1 && (
            <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-fg">
              {notification.count} new
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{notification.body}</span>
      </span>
    </button>
  );
}
