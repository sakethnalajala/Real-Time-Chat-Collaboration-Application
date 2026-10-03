import { Suspense, lazy } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { AdminRoute, GuestRoute, ProtectedRoute } from './components/routing/Guards.jsx';
import { PageLoader } from './components/ui/Feedback.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import RouteError from './pages/RouteError.jsx';

const page = (loader) => {
  const Component = lazy(loader);
  return <Component />;
};

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: page(() => import('./pages/LandingPage.jsx')) },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: page(() => import('./pages/auth/LoginPage.jsx')) },
              { path: '/register', element: page(() => import('./pages/auth/RegisterPage.jsx')) },
              { path: '/forgot-password', element: page(() => import('./pages/auth/ForgotPasswordPage.jsx')) },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [{ path: '/reset-password/:token', element: page(() => import('./pages/auth/ResetPasswordPage.jsx')) }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: 'dashboard', element: page(() => import('./pages/app/DashboardPage.jsx')) },
              {
                path: 'chats',
                element: page(() => import('./pages/app/ChatsPage.jsx')),
                children: [
                  { index: true, element: page(() => import('./pages/app/ChatEmptyPage.jsx')) },
                  { path: ':conversationId', element: page(() => import('./pages/app/ChatPage.jsx')) },
                ],
              },
              { path: 'people', element: page(() => import('./pages/app/PeoplePage.jsx')) },
              { path: 'users/:id', element: page(() => import('./pages/app/UserProfilePage.jsx')) },
              { path: 'notifications', element: page(() => import('./pages/app/NotificationsPage.jsx')) },
              { path: 'profile', element: page(() => import('./pages/app/ProfilePage.jsx')) },
              { path: 'settings', element: page(() => import('./pages/app/SettingsPage.jsx')) },
              {
                path: 'admin',
                element: <AdminRoute />,
                children: [
                  { index: true, element: page(() => import('./pages/admin/AdminDashboardPage.jsx')) },
                  { path: 'users', element: page(() => import('./pages/admin/AdminUsersPage.jsx')) },
                  { path: 'users/:id', element: page(() => import('./pages/admin/AdminUserDetailPage.jsx')) },
                  { path: 'conversations', element: page(() => import('./pages/admin/AdminConversationsPage.jsx')) },
                  { path: 'conversations/:id', element: page(() => import('./pages/admin/AdminConversationDetailPage.jsx')) },
                  { path: 'reports', element: page(() => import('./pages/admin/AdminReportsPage.jsx')) },
                  { path: 'reports/:id', element: page(() => import('./pages/admin/AdminReportDetailPage.jsx')) },
                  { path: 'audit', element: page(() => import('./pages/admin/AdminAuditPage.jsx')) },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: page(() => import('./pages/NotFoundPage.jsx')) },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: '!rounded-xl !border-line !shadow-2xl' } }}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <Suspense fallback={<PageLoader fullScreen />}>
              <RouterProvider router={router} />
            </Suspense>
            <ThemedToaster />
          </AuthProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
