import { Link, useLocation } from 'react-router';
import { Bell, ChevronRight, Flag, Gauge, LayoutDashboard, MessageSquare, MessagesSquare, ScrollText, Settings, User, UserRound, Users, UsersRound } from 'lucide-react';
import { useNotificationCount } from '../../hooks/useConversations.js';
import { usePersistTheme } from '../../hooks/usePersistTheme.js';
import { cn } from '../../utils/cn.js';
import ThemeSwitch from './ThemeSwitch.jsx';

const PAGES = [
  { match: /^\/dashboard/, title: 'Dashboard', icon: LayoutDashboard },
  { match: /^\/chats/, title: 'Chats', icon: MessagesSquare },
  { match: /^\/people/, title: 'People', icon: Users },
  { match: /^\/users\//, title: 'Profile', icon: UserRound },
  { match: /^\/notifications/, title: 'Notifications', icon: Bell },
  { match: /^\/profile/, title: 'Your profile', icon: User },
  { match: /^\/settings/, title: 'Settings', icon: Settings },
  { match: /^\/admin\/users/, title: 'Users', icon: UsersRound, section: 'Admin' },
  { match: /^\/admin\/conversations/, title: 'Conversations', icon: MessageSquare, section: 'Admin' },
  { match: /^\/admin\/reports/, title: 'Reports', icon: Flag, section: 'Admin' },
  { match: /^\/admin\/audit/, title: 'Audit log', icon: ScrollText, section: 'Admin' },
  { match: /^\/admin/, title: 'Overview', icon: Gauge, section: 'Admin' },
];

/** Desktop/tablet header: page context on the left, notifications + theme switch in the top-right corner. */
export default function AppTopBar({ className }) {
  const { pathname } = useLocation();
  const { data: unread = 0 } = useNotificationCount();
  const page = PAGES.find((p) => p.match.test(pathname)) ?? PAGES[0];

  const persistTheme = usePersistTheme();

  return (
    <header className={cn('glass relative z-20 h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-5 lg:px-6', className)}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        {page.section && (
          <>
            <Link to="/admin" className="text-subtle transition hover:text-fg">
              {page.section}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          </>
        )}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-400">
          <page.icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate font-semibold text-fg">{page.title}</span>
      </nav>

      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          className="relative rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
          title="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
        <span className="h-6 w-px bg-line" aria-hidden />
        <ThemeSwitch onToggle={persistTheme} />
      </div>
    </header>
  );
}
