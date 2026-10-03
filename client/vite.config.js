import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // On Vercel, REST always goes through the /api rewrite in vercel.json: it keeps the session cookie
  // first-party and needs no CORS. An absolute VITE_API_URL set in the Vercel dashboard would call
  // Render cross-site instead (blocked origin, cookie dropped on reload), so it is ignored there.
  if (process.env.VERCEL && /^https?:\/\//i.test(env.VITE_API_URL || '')) {
    console.warn(`[vite] Vercel build: ignoring VITE_API_URL=${env.VITE_API_URL} — using the /api rewrite from vercel.json.`);
    process.env.VITE_API_URL = '/api';
  }

  // In development the Vite server proxies REST, uploads and WebSockets to the API,
  // mirroring the production Vercel rewrite (same-origin cookies, no CORS needed).
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
    '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
    build: { sourcemap: false, chunkSizeWarningLimit: 1000 },
  };
});
