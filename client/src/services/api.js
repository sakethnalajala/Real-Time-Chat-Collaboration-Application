import axios from 'axios';
import { API_URL } from '../config/env.js';

/**
 * The access token lives in memory only (never localStorage). The refresh token is an
 * httpOnly cookie the browser sends to /api/auth/refresh automatically.
 */
let accessToken = null;
const tokenListeners = new Set();

export const tokenStore = {
  get: () => accessToken,
  set(token) {
    accessToken = token;
    tokenListeners.forEach((listener) => listener(token));
  },
  subscribe(listener) {
    tokenListeners.add(listener);
    return () => tokenListeners.delete(listener);
  },
};

const handlers = { onSessionExpired: null, onSuspended: null, onRefreshed: null };
export const setAuthHandlers = (next) => Object.assign(handlers, next);

export const api = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 60_000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

async function doRefresh() {
  const response = await axios.post(`${API_URL}/auth/refresh`, null, { withCredentials: true, timeout: 30_000 });
  const data = response.data.data;
  tokenStore.set(data.accessToken);
  handlers.onRefreshed?.(data.user);
  return data;
}

/**
 * Single-flight token refresh. Across tabs, the Web Locks API serialises refreshes so two tabs
 * never rotate the same refresh token simultaneously.
 */
export function refreshAccessToken() {
  if (!refreshPromise) {
    const run = navigator.locks?.request ? navigator.locks.request('nebula-token-refresh', doRefresh) : doRefresh();
    refreshPromise = run.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/demo-login', '/auth/forgot-password', '/auth/reset-password', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const code = response?.data?.error?.code;

    if (response?.status === 401 && config && !config._retried && !NO_RETRY.some((path) => config.url?.startsWith(path))) {
      config._retried = true;
      try {
        await refreshAccessToken();
        config.headers.Authorization = `Bearer ${tokenStore.get()}`;
        return api(config);
      } catch (refreshError) {
        handlers.onSessionExpired?.(refreshError?.response?.data?.error?.message);
        return Promise.reject(error);
      }
    }

    if (response?.status === 403 && code === 'ACCOUNT_SUSPENDED') {
      handlers.onSuspended?.(response.data.error.message);
    }
    return Promise.reject(error);
  }
);

/** Unwraps the `{ success, data }` envelope. */
export const unwrap = (promise) => promise.then((response) => response.data?.data);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return fallback;
}

export const getErrorCode = (error) => error?.response?.data?.error?.code;

/** Maps validation details to `{ fieldPath: message }` for forms. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.path, d.message]));
}
