import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { storage } from '../services/storage/index.js';
import { mailService } from '../services/mail.service.js';
import { ATTACHMENT_TYPES, LIMITS } from '../utils/constants.js';
import { ok } from '../utils/respond.js';

export function health(_req, res) {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    data: {
      status: dbConnected ? 'ok' : 'degraded',
      database: dbConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}

/** Public, non-secret runtime configuration the client uses to adapt its UI. */
export function publicConfig(_req, res) {
  ok(res, {
    appName: config.appName,
    demo: {
      enabled: config.demo.enabled,
      // Demo accounts are intentionally public (they cannot change their password, and the demo
      // admin can only manage demo accounts). Passwords are listed only when configured.
      accounts: config.demo.enabled
        ? config.demo.accounts.map(({ key, label, fullName, username, email, role, password }) => ({
            key,
            label,
            fullName,
            username,
            email,
            role,
            password: config.demo.showCredentials && password ? password : null,
          }))
        : [],
    },
    uploads: {
      enabled: storage.enabled,
      driver: storage.driverName,
      maxFileSizeMB: config.storage.maxFileSizeMB,
      maxAvatarSizeMB: config.storage.maxAvatarSizeMB,
      maxFilesPerMessage: config.storage.maxFilesPerMessage,
      accept: Object.keys(ATTACHMENT_TYPES),
    },
    email: {
      configured: mailService.isConfigured(),
      // How "Forgot password" works on this server: email, on-screen link (development) or admin-issued link.
      passwordReset: mailService.isConfigured() ? 'email' : config.isProd ? 'admin' : 'on-screen',
      devResetLinks: !config.isProd && !mailService.isConfigured(),
      resetLinkMinutes: config.mail.resetTtlMinutes,
    },
    limits: {
      messageMaxLength: LIMITS.MESSAGE_MAX_LENGTH,
      groupMaxMembers: LIMITS.GROUP_MAX_MEMBERS,
      bioMaxLength: LIMITS.BIO_MAX_LENGTH,
    },
  });
}
