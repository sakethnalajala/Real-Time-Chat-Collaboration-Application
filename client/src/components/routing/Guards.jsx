import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { SocketProvider } from '../../context/SocketContext.jsx';
import { PageLoader } from '../ui/Feedback.jsx';

/** Authenticated area: restores the session, then opens the realtime connection. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader fullScreen label="Restoring your session…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <SocketProvider>
      <Outlet />
    </SocketProvider>
  );
}

/** Login/register pages: signed-in users are sent to the app. */
export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader fullScreen />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  return <Outlet />;
}

/** Admin area (UI guard only — every admin API also enforces the role server-side). */
export function AdminRoute() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
