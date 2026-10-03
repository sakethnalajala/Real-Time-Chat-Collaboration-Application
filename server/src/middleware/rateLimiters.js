import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const MINUTE = 60 * 1000;

const create = ({ windowMs, limit, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest && process.env.ENABLE_RATE_LIMITS_IN_TESTS !== 'true',
    handler: (_req, _res, next) => next(new AppError(429, message, 'RATE_LIMITED')),
  });

const ipKey = (req) => ipKeyGenerator(req.ip || '0.0.0.0');
const userKey = (req) => (req.user ? `user:${req.user._id}` : ipKey(req));

export const apiLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 1500,
  message: 'Too many requests. Please slow down and try again shortly.',
});

export const loginLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 10,
  keyGenerator: (req) => `${ipKey(req)}:${String(req.body?.email || '').toLowerCase().slice(0, 254)}`,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

export const demoLoginLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 30,
  keyGenerator: (req) => `${ipKey(req)}:demo:${String(req.body?.account || '').slice(0, 10)}`,
  message: 'Too many demo sign-ins from this network. Please wait a few minutes.',
});

export const registerLimiter = create({
  windowMs: 60 * MINUTE,
  limit: 10,
  message: 'Too many accounts created from this network. Please try again later.',
});

export const passwordResetLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 5,
  message: 'Too many password reset requests. Please wait a few minutes.',
});

export const refreshLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 200,
  message: 'Too many session refreshes. Please wait a moment.',
});

export const sensitiveActionLimiter = create({
  windowMs: 15 * MINUTE,
  limit: 10,
  keyGenerator: userKey,
  message: 'Too many attempts. Please wait a few minutes.',
});

export const messageLimiter = create({
  windowMs: 10 * 1000,
  limit: 30,
  keyGenerator: userKey,
  message: "You're sending messages too quickly. Please slow down.",
});

export const uploadLimiter = create({
  windowMs: 10 * MINUTE,
  limit: 40,
  keyGenerator: userKey,
  message: 'Upload limit reached. Please wait a few minutes before sharing more files.',
});

export const reportLimiter = create({
  windowMs: 60 * MINUTE,
  limit: 15,
  keyGenerator: userKey,
  message: 'You have submitted many reports recently. Please try again later.',
});
