import { NavLink, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useNotificationCount, useTotalUnread } from '../../hooks/useConversations.js';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import Logo from '../ui/Logo.jsx';
import { Menu } from '../ui/Menu.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import { usePersistTheme } from '../../hooks/usePersistTheme.js';
import { MOBILE_NAV } from './navigation.js';

export function MobileTopBar({ className }) {
  const { user, isAdmin, logout } = useAuth();
  const { status } = useSocket();
  const navigate = useNavigate();
  const persistTheme = usePersistTheme();
  return (
    <header className={cn('glass sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line px-4', className)}>
      <NavLink to="/dashboard" aria-label="Dashboard">
        <Logo size="sm" />
      </NavLink>
      <div className="flex items-center gap-2">
        <Menu
          trigger={
            <button type="button" className="rounded-full p-1" aria-label="Account menu">
              <Avatar src={user?.avatarUrl} name={user?.fullName} size="sm" online={status === 'connected'} />
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
        <ThemeSwitch onToggle={persistTheme} />
      </div>
    </header>
  );
}

export function MobileNav({ className }) {
  const totalUnread = useTotalUnread();
  const { data: notificationCount = 0 } = useNotificationCount();
  const badges = { unread: totalUnread, notifications: notificationCount };

  return (
    <nav
      aria-label="Primary"
      className={cn('glass z-20 grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)]', className)}
    >
      {MOBILE_NAV.map((item) => {
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-fg' : 'text-subtle')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-brand-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">
                  <item.icon className={cn('h-5 w-5', isActive && 'text-brand-400')} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
