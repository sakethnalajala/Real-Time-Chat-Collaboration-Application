import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import Sidebar from '../components/layout/Sidebar.jsx';
import { MobileNav, MobileTopBar } from '../components/layout/MobileNav.jsx';
import ConnectionBanner from '../components/layout/ConnectionBanner.jsx';
import AppTopBar from '../components/layout/AppTopBar.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { useRealtimeSync } from '../hooks/useRealtimeSync.jsx';

export default function AppLayout() {
  useRealtimeSync();
  const { pathname } = useLocation();
  // Inside an open chat on phones, the chat gets the full screen.
  const inChat = /^\/chats\/[^/]+/.test(pathname);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        {!inChat && <MobileTopBar className="md:hidden" />}
        <AppTopBar className="hidden md:flex" />
        <ConnectionBanner />
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
        {!inChat && <MobileNav className="md:hidden" />}
      </div>
    </div>
  );
}

/** Scrollable, centred page body with a subtle entrance animation. */
export function PageContainer({ children, className = '', wide = false }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={`mx-auto w-full animate-fade-up px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${wide ? 'max-w-7xl' : 'max-w-5xl'} ${className}`}>
        {children}
      </div>
    </div>
  );
}
