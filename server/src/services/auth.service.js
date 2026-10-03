import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { BCRYPT_ROUNDS } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/helpers.js';
import { selfUser } from '../utils/serializers.js';
import { USER_STATUS } from '../utils/constants.js';
import { disconnectUser } from '../sockets/emitter.js';
import * as tokens from './token.service.js';
import { mailService } from './mail.service.js';
import { storage } from './storage/index.js';

let dummyHash;
/** Comparing against a dummy hash keeps response time constant for unknown emails. */
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('timing-equalisation-only', BCRYPT_ROUNDS));

async function issueTokens(user, req) {
  const { token } = await tokens.createSession(user._id, req);
  return { user: selfUser(user), accessToken: tokens.signAccessToken(user), refreshToken: token };
}

const suspendedError = (user) =>
  AppError.forbidden(
    `Your account has been suspended${user.statusReason ? `: ${user.statusReason}` : '.'} Contact support if you believe this is a mistake.`,
    'ACCOUNT_SUSPENDED'
  );

export async function register({ fullName, username, email, password }, avatarFile, req) {
  const normalizedEmail = email.toLowerCase();
  const normalizedUsername = username.toLowerCase();

  const existing = await User.find({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] })
    .select('email username')
    .lean();
  const details = [];
  if (existing.some((u) => u.email === normalizedEmail)) details.push({ path: 'email', message: 'An account with this email already exists' });
  if (existing.some((u) => u.username === normalizedUsername)) details.push({ path: 'username', message: 'This username is already taken' });
  if (details.length) throw AppError.conflict(details[0].message, details, 'ACCOUNT_EXISTS');

  const avatar = avatarFile ? await storage.upload(avatarFile, { folder: 'avatars', kind: 'image', variant: 'avatar' }) : null;

  let user;
  try {
    user = await User.create({
      fullName,
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      avatar: avatar ? { url: avatar.url, publicId: avatar.publicId, provider: avatar.provider } : null,
    });
  } catch (err) {
    if (avatar) storage.remove(avatar);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'email';
      throw AppError.conflict(`That ${field} is already in use`, [{ path: field, message: `That ${field} is already in use` }], 'ACCOUNT_EXISTS');
    }
    throw err;
  }

  const fresh = await User.findById(user._id).select('+tokenVersion');
  return issueTokens(fresh, req);
}

export async function login({ email, password }, req) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +tokenVersion');
  const valid = user ? await user.comparePassword(password) : await bcrypt.compare(password, await getDummyHash());

  if (!user || !valid) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.status !== USER_STATUS.ACTIVE) throw suspendedError(user);

  return issueTokens(user, req);
}

export async function demoLogin(accountKey, req) {
  if (!config.demo.enabled) throw AppError.notFound('Demo login is disabled', 'DEMO_DISABLED');
  const account = config.demo.accounts.find((a) => a.key === accountKey);
  if (!account) throw AppError.badRequest('Unknown demo account');

  const user = await User.findOne({ email: account.email, isDemo: true }).select('+tokenVersion');
  if (!user) throw AppError.unavailable('Demo accounts are not set up yet. Run "npm run seed" in /server.', 'DEMO_NOT_READY');
  if (user.status !== USER_STATUS.ACTIVE) throw suspendedError(user);

  return issueTokens(user, req);
}

export async function refresh(rawToken, req) {
  if (!rawToken) throw AppError.unauthorized('No active session', 'NO_SESSION');
  const { userId, token } = await tokens.rotateSession(rawToken, req);

  const user = await User.findById(userId).select('+tokenVersion');
  if (!user) throw AppError.unauthorized('Account not found', 'SESSION_INVALID');
  if (user.status !== USER_STATUS.ACTIVE) {
    await tokens.revokeAllSessions(user._id, 'admin');
    throw suspendedError(user);
  }

  return { user: selfUser(user), accessToken: tokens.signAccessToken(user), refreshToken: token };
}

export async function logout(rawToken) {
  await tokens.revokeSession(rawToken, 'logout');
}

export async function logoutAll(userId) {
  await tokens.revokeAllSessions(userId, 'logout_all');
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  disconnectUser(userId, 'account:logout', { reason: 'logout_all' });
}

/**
 * Creates a single-use password reset link (only a SHA-256 hash of the token is stored).
 * Used by "Forgot password" and by admins, who can hand a link to a user when no email
 * service is configured.
 */
export async function issuePasswordResetLink(user) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.mail.resetTtlMinutes * 60 * 1000);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = expiresAt;
  await user.save({ validateBeforeSave: false });
  return { resetUrl: `${config.clientUrl}/reset-password/${token}`, expiresAt };
}

export async function forgotPassword(email) {
  // Decide before looking anything up, so the response never reveals whether an account exists.
  // Without an email service, production never returns links (that would let anyone reset any
  // account); users ask an administrator for a reset link instead.
  if (config.isProd && !mailService.isConfigured()) {
    throw AppError.unavailable(
      'Password reset by email is turned off on this server. Ask an administrator to create a reset link for you.',
      'EMAIL_NOT_CONFIGURED'
    );
  }

  const response = { message: 'If an account exists for that email, a password reset link has been sent.' };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.status !== USER_STATUS.ACTIVE) return response;
  if (user.isDemo && config.demo.enabled) return response;

  const { resetUrl } = await issuePasswordResetLink(user);
  const result = await mailService.sendPasswordReset({ to: user.email, name: user.fullName, url: resetUrl });

  // Development-only convenience when SMTP is not configured.
  if (!config.isProd && result.devResetUrl) return { ...response, devResetUrl: result.devResetUrl };
  return response;
}

export async function validateResetToken(token) {
  const exists = await User.exists({ passwordResetTokenHash: sha256(token), passwordResetExpires: { $gt: new Date() } });
  if (!exists) throw AppError.badRequest('This reset link is invalid or has expired', undefined, 'RESET_TOKEN_INVALID');
  return { valid: true };
}

export async function resetPassword(token, password) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +tokenVersion +passwordResetTokenHash +passwordResetExpires');

  if (!user) throw AppError.badRequest('This reset link is invalid or has expired', undefined, 'RESET_TOKEN_INVALID');

  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion += 1;
  await user.save();

  await tokens.revokeAllSessions(user._id, 'password_reset');
  disconnectUser(user._id, 'account:logout', { reason: 'password_reset' });
  mailService.sendPasswordChanged({ to: user.email, name: user.fullName });
  return { message: 'Your password has been reset. You can now sign in.' };
}

export async function changePassword(userId, currentRefreshToken, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password +tokenVersion');
  if (!user) throw AppError.unauthorized();
  if (user.isDemo && config.demo.enabled) {
    throw AppError.forbidden('Demo accounts cannot change their password.', 'DEMO_RESTRICTED');
  }
  if (!(await user.comparePassword(currentPassword))) {
    throw AppError.badRequest('Current password is incorrect', [{ path: 'currentPassword', message: 'Current password is incorrect' }], 'INVALID_PASSWORD');
  }
  if (currentPassword === newPassword) {
    throw AppError.badRequest('Choose a password you have not used just now', [{ path: 'newPassword', message: 'New password must be different from the current one' }]);
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();

  // Sign out every other device; this one keeps its session and gets a fresh access token.
  await tokens.revokeAllSessions(user._id, 'password_change', { exceptToken: currentRefreshToken });
  disconnectUser(user._id);
  mailService.sendPasswordChanged({ to: user.email, name: user.fullName });

  return { accessToken: tokens.signAccessToken(user), user: selfUser(user) };
}
