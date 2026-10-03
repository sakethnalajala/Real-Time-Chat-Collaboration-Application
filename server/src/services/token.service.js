import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { Session } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
    issuer: config.jwt.issuer,
    algorithm: 'HS256',
  });
}

/** Verifies an access token. Throws AppError(401) with TOKEN_EXPIRED / INVALID_TOKEN codes. */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer, algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw AppError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    throw AppError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
}

const requestMeta = (req) => ({
  userAgent: String(req?.get?.('user-agent') || '').slice(0, 400),
  ip: String(req?.ip || '').slice(0, 100),
});

/** Creates a refresh-token session. Returns the raw token (only ever sent in an httpOnly cookie). */
export async function createSession(userId, req, family = randomToken(16)) {
  const token = randomToken(48);
  const session = await Session.create({
    user: userId,
    tokenHash: sha256(token),
    family,
    expiresAt: new Date(Date.now() + config.refresh.ttlDays * DAY_MS),
    ...requestMeta(req),
  });
  return { token, session };
}

export const findSessionByToken = (rawToken) =>
  rawToken ? Session.findOne({ tokenHash: sha256(rawToken) }) : Promise.resolve(null);

/**
 * Rotates a refresh token. Reusing a rotated token is treated as theft:
 * every session in that token family is revoked.
 */
export async function rotateSession(rawToken, req) {
  const session = await findSessionByToken(rawToken);
  if (!session) throw AppError.unauthorized('Session not found. Please sign in again.', 'SESSION_INVALID');

  if (session.revokedAt) {
    // Two tabs refreshing at the same moment both present the same token. A reuse within a few
    // seconds of rotation is treated as that race (new session, same family), not as theft.
    const graceMs = config.refresh.reuseGraceSeconds * 1000;
    if (session.revokedReason === 'rotated' && Date.now() - session.revokedAt.getTime() <= graceMs) {
      const next = await createSession(session.user, req, session.family);
      return { userId: session.user, ...next };
    }
    if (session.revokedReason === 'rotated') {
      await Session.updateMany(
        { family: session.family, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'reuse_detected' } }
      );
    }
    throw AppError.unauthorized('Session has ended. Please sign in again.', 'SESSION_REVOKED');
  }

  if (session.expiresAt <= new Date()) throw AppError.unauthorized('Session expired. Please sign in again.', 'SESSION_EXPIRED');

  // Atomic claim prevents two parallel refreshes from both succeeding.
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'rotated', lastUsedAt: new Date() } }
  );
  if (!claimed) throw AppError.unauthorized('Session has ended. Please sign in again.', 'SESSION_REVOKED');

  const next = await createSession(session.user, req, session.family);
  return { userId: session.user, ...next };
}

export async function revokeSession(rawToken, reason = 'logout') {
  if (!rawToken) return;
  await Session.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

export async function revokeAllSessions(userId, reason, { exceptToken } = {}) {
  const filter = { user: userId, revokedAt: null };
  if (exceptToken) filter.tokenHash = { $ne: sha256(exceptToken) };
  await Session.updateMany(filter, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

export const countActiveSessions = (userId) =>
  Session.countDocuments({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } });

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.refresh.cookieSecure,
  sameSite: config.refresh.cookieSameSite,
  path: config.refresh.cookiePath,
});

export function setRefreshCookie(res, token) {
  res.cookie(config.refresh.cookieName, token, { ...cookieOptions(), maxAge: config.refresh.ttlDays * DAY_MS });
}

export function clearRefreshCookie(res) {
  res.clearCookie(config.refresh.cookieName, cookieOptions());
}

export const readRefreshCookie = (req) => req.cookies?.[config.refresh.cookieName] || null;
