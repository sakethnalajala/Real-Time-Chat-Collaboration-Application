import { config } from './env.js';

// In development, also accept the Vite dev server when opened via localhost or a LAN IP (phone testing).
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

// Allowing an extra origin can't expose a session: the refresh cookie is first-party on the
// frontend's domain (via the Vercel /api rewrite) and API calls authenticate with a bearer token.
export function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin, curl, Postman, server-to-server
  if (config.corsOrigins.includes(origin)) return true;
  if (config.corsOriginPatterns.some((pattern) => pattern.test(origin))) return true;
  return !config.isProd && DEV_ORIGIN.test(origin);
}

export const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) return callback(null, true);
  return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
};

export const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};
