import { Bell, Flag, Gauge, Home, LayoutDashboard, MessageSquare, MessagesSquare, ScrollText, Settings, User, Users, UsersRound } from 'lucide-react';

export const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/chats', label: 'Chats', icon: MessagesSquare, badge: 'unread' },
  { to: '/people', label: 'People', icon: Users },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/users', label: 'Users', icon: UsersRound },
  { to: '/admin/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

export const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/chats', label: 'Chats', icon: MessagesSquare, badge: 'unread' },
  { to: '/people', label: 'People', icon: Users },
  { to: '/notifications', label: 'Alerts', icon: Bell, badge: 'notifications' },
  { to: '/profile', label: 'Me', icon: User },
];
