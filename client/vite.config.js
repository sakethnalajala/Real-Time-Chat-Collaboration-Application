import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
