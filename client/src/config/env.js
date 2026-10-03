/**
 * Public client configuration (Vite exposes only VITE_* variables — never put secrets here).
 *
 * VITE_API_URL     REST base URL. Default "/api": same origin, proxied to the API by Vite in
 *                  development and by the Vercel rewrite in production.
 * VITE_SOCKET_URL  Socket.IO server URL. Default: current origin (Vite proxies WebSockets in dev).
 *                  In production set it to the Render URL — Vercel cannot proxy WebSockets.
 */
const trimSlash = (value) => value.replace(/\/+$/, '');

export const API_URL = trimSlash(import.meta.env.VITE_API_URL || '/api');

export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL || window.location.origin);

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nebula Chat';

export const ENABLE_DEMO_LOGIN = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

const API_ORIGIN = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : '';

/** Resolves server-relative file URLs (local storage driver) against the API origin. */
export const assetUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/') && API_ORIGIN) return `${API_ORIGIN}${url}`;
  return url;
};
