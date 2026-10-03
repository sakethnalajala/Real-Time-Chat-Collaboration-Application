import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refreshAccessToken, setAuthHandlers, tokenStore } from '../services/api.js';
import { authService } from '../services/index.js';
import { activeConversationStore, presenceActions, typingActions } from '../utils/stores.js';
import { useTheme } from './ThemeContext.jsx';

const AuthContext = createContext(null);

/* A non-secret hint that this browser has signed in before, so guests don't trigger a refresh call. */
const SESSION_HINT = 'nebula-session';
const hint = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === '1';
    } catch {
      return true;
    }
  },
  set: (value) => {
    try {
      if (value) localStorage.setItem(SESSION_HINT, '1');
      else localStorage.removeItem(SESSION_HINT);
    } catch {
      /* storage unavailable */
    }
  },
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const [state, setState] = useState({ status: 'loading', user: null });
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  const resetClientState = useCallback(() => {
    queryClient.clear();
    presenceActions.reset();
    typingActions.reset();
    activeConversationStore.set(null);
  }, [queryClient]);

  const applySession = useCallback(
    ({ user, accessToken }) => {
      if (accessToken) tokenStore.set(accessToken);
      hint.set(true);
      if (user?.settings?.theme) setTheme(user.settings.theme);
      setState({ status: 'authenticated', user });
    },
    [setTheme]
  );

  /** Clears the local session (used for logout, expiry, suspension). */
  const endSession = useCallback(() => {
    tokenStore.set(null);
    hint.set(false);
    resetClientState();
    setState({ status: 'guest', user: null });
  }, [resetClientState]);

  // Restore the session from the httpOnly refresh cookie on page load.
  useEffect(() => {
    let cancelled = false;
    if (!hint.get()) {
      setState({ status: 'guest', user: null });
      return undefined;
    }
    refreshAccessToken()
      .then((data) => {
        if (!cancelled) applySession(data);
      })
      .catch(() => {
        hint.set(false);
        if (!cancelled) setState({ status: 'guest', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    setAuthHandlers({
      onSessionExpired: (message) => {
        if (statusRef.current === 'authenticated') toast.error(message || 'Your session has expired. Please sign in again.');
        endSession();
      },
      onSuspended: (message) => {
        toast.error(message || 'Your account has been suspended.');
        endSession();
      },
      onRefreshed: (user) =>
        setState((current) => (current.status === 'authenticated' && user ? { ...current, user: { ...current.user, ...user } } : current)),
    });
  }, [endSession]);

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials);
      resetClientState();
      applySession(data);
      return data.user;
    },
    [applySession, resetClientState]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload);
      resetClientState();
      applySession(data);
      return data.user;
    },
    [applySession, resetClientState]
  );

  const demoLogin = useCallback(
    async (account) => {
      const data = await authService.demoLogin(account);
      resetClientState();
      applySession(data);
      return data.user;
    },
    [applySession, resetClientState]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* the local session is cleared regardless */
    }
    endSession();
  }, [endSession]);

  const updateUser = useCallback((patch) => {
    setState((current) => (current.user ? { ...current, user: { ...current.user, ...patch } } : current));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated',
      isAdmin: state.user?.role === 'admin',
      login,
      register,
      demoLogin,
      logout,
      endSession,
      updateUser,
      applySession,
    }),
    [state, login, register, demoLogin, logout, endSession, updateUser, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
