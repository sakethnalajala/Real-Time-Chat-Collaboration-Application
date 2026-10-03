/**
 * Public client configuration (Vite exposes only VITE_* variables — never put secrets here).
 *
 * VITE_API_URL     REST base URL. Default "/api": same origin, proxied to the API by Vite in
 *                  development and by the Vercel rewrite in production.
 * VITE_SOCKET_URL  Socket.IO server URL. Default: current origin (Vite proxies WebSockets in dev).
 *                  In production set it to the Render URL — Vercel cannot proxy WebSockets.
 */
const trimSlash = (value) => value.replace(/\/+$/, '');
const isAbsolute = (value) => /^https?:\/\//i.test(value);

// "https://api.example.com" → "https://api.example.com/api" (the API lives under /api).
const resolveApiUrl = (value) => {
  const url = trimSlash(value || '/api');
  return isAbsolute(url) && new URL(url).pathname === '/' ? `${url}/api` : url;
};

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);

// Socket.IO is served from the server root, so only the origin is used ("…onrender.com/api" → "…onrender.com").
const socketUrl = import.meta.env.VITE_SOCKET_URL;
export const SOCKET_URL = socketUrl && isAbsolute(socketUrl) ? new URL(socketUrl).origin : window.location.origin;

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nebula Chat';

export const ENABLE_DEMO_LOGIN = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

const API_ORIGIN = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : '';

/** Resolves server-relative file URLs (local storage driver) against the API origin. */
export const assetUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/') && API_ORIGIN) return `${API_ORIGIN}${url}`;
  return url;
};
