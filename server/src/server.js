import http from 'node:http';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';
import { bootstrapDemo } from './services/demo.service.js';
import { mailService } from './services/mail.service.js';
import { storage } from './services/storage/index.js';
import { logger } from './utils/logger.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries the initial connection (the local dev database or Atlas may still be starting). */
async function connectWithRetry() {
  const maxAttempts = config.isProd ? 5 : 30;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await connectDatabase();
    } catch (err) {
      if (attempt >= maxAttempts || err.message.startsWith('MONGODB_URI is not set')) throw err;
      logger.warn(`[db] Connection attempt ${attempt} failed (${err.message}). Retrying in 3s…`);
      await wait(3000);
    }
  }
}

async function start() {
  await connectWithRetry();
  await bootstrapDemo();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);

  server.listen(config.port, () => {
    logger.info(`[server] ${config.appName} API listening on http://localhost:${config.port} (${config.env})`);
    logger.info(`[server] CORS origins: ${config.corsOrigins.join(', ')}`);
    logger.info(`[server] File storage: ${storage.driverName}${storage.enabled ? '' : ' (uploads disabled)'}`);
    logger.info(
      `[server] Email: ${mailService.isConfigured() ? 'SMTP configured' : config.isProd ? 'not used — password resets via admin-created reset links' : 'not used — reset links are shown on screen and logged here (dev)'}`
    );
    logger.info(`[server] Demo mode: ${config.demo.enabled ? 'on' : 'off'}`);
    if (config.jwt.accessSecretGenerated) {
      logger.warn('[server] JWT_ACCESS_SECRET not set — using a temporary development secret.');
    }
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[server] ${signal} received — shutting down gracefully`);
    io.close();
    server.close();
    await disconnectDatabase().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => logger.error('[process] Unhandled rejection:', reason));

start().catch((err) => {
  logger.error('[server] Failed to start:', err.message);
  process.exit(1);
});
