import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useNotificationCount, useTotalUnread } from '../../hooks/useConversations.js';
import { useMediaQuery } from '../../hooks/useUtils.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import { CountBadge } from '../ui/Feedback.jsx';
import Logo from '../ui/Logo.jsx';
import { Menu } from '../ui/Menu.jsx';
import { ADMIN_NAV, MAIN_NAV } from './navigation.js';

const STORAGE_KEY = 'nebula-sidebar-collapsed';

function NavItem({ item, collapsed, badgeCount }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          isActive ? 'text-fg' : 'text-muted hover:text-fg'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl border border-brand-500/25 bg-linear-to-r from-brand-500/18 to-brand-500/5"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          )}
          {!isActive && <span className="absolute inset-0 rounded-xl transition-colors group-hover:bg-surface-2" />}
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <item.icon className={cn('h-[19px] w-[19px] transition-colors', isActive && 'text-brand-400')} />
            {collapsed && badgeCount > 0 && <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-surface" />}
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="relative flex flex-1 items-center justify-between truncate"
              >
                {item.label}
                <CountBadge count={badgeCount} />
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ className }) {
  const { user, isAdmin, logout } = useAuth();
  const { status } = useSocket();
  const navigate = useNavigate();
  const totalUnread = useTotalUnread();
  const { data: notificationCount = 0 } = useNotificationCount();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [preference, setPreference] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? null : stored === 'true';
    } catch {
      return null;
    }
  });
  const collapsed = preference ?? !isWide;

  useEffect(() => {
    try {
      if (preference !== null) localStorage.setItem(STORAGE_KEY, String(preference));
    } catch {
      /* ignore */
    }
  }, [preference]);

  const badges = { unread: totalUnread, notifications: notificationCount };

  return (
    <motion.aside
      animate={{ width: collapsed ? 84 : 268 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className={cn('relative z-20 h-dvh shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur-xl', className)}
    >
      <div className={cn('flex h-16 items-center px-5', collapsed ? 'justify-center px-0' : 'justify-between')}>
        <NavLink to="/dashboard" aria-label="Dashboard">
          <Logo showText={!collapsed} />
        </NavLink>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 no-scrollbar" aria-label="Main">
        {MAIN_NAV.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} badgeCount={item.badge ? badges[item.badge] : 0} />
        ))}

        {isAdmin && (
          <div className="pt-5">
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-2 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-widest text-subtle uppercase"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> Administration
                </motion.p>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-line" />
              )}
            </AnimatePresence>
            <div className="space-y-1">
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <div className={cn('flex', collapsed ? 'justify-center' : 'justify-end')}>
          <button
            type="button"
            onClick={() => setPreference(!collapsed)}
            className="rounded-xl p-2.5 text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        <Menu
          align="start"
          width={230}
          className="w-full"
          trigger={
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-2', collapsed && 'justify-center')}
              aria-label="Account menu"
            >
              <Avatar src={user?.avatarUrl} name={user?.fullName} size="sm" online={status === 'connected'} />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{user?.fullName}</span>
                  <span className="block truncate text-xs text-subtle">@{user?.username}</span>
                </span>
              )}
            </button>
          }
          items={[
            { label: 'Your profile', icon: User, onClick: () => navigate('/profile') },
            { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
            { label: 'Admin dashboard', icon: ShieldCheck, onClick: () => navigate('/admin'), hidden: !isAdmin },
            { divider: true },
            { label: 'Sign out', icon: LogOut, danger: true, onClick: logout },
          ]}
        />
      </div>
    </motion.aside>
  );
}
