import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

let transporter = null;

if (config.mail.configured) {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const layout = (title, bodyHtml) => `<!doctype html>
<html><body style="margin:0;background:#0b0a10;font-family:Inter,Segoe UI,Arial,sans-serif;color:#ece9f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#14111d;border:1px solid #2a2340;border-radius:16px;padding:32px">
        <tr><td>
          <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px">${escapeHtml(config.appName)}</div>
          <div style="height:3px;width:48px;background:linear-gradient(90deg,#7c3aed,#a855f7);border-radius:3px;margin-bottom:24px"></div>
          <h1 style="font-size:18px;margin:0 0 12px;color:#fff">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

export const mailService = {
  isConfigured: () => Boolean(transporter),

  /**
   * Sends the password reset email.
   * Without SMTP: development logs the link (and returns it so the UI can show it);
   * production refuses with 503 so users are not told an email was sent when it was not.
   */
  async sendPasswordReset({ to, name, url }) {
    const minutes = config.mail.resetTtlMinutes;

    if (!transporter) {
      if (config.isProd) {
        throw AppError.unavailable(
          'Password reset emails are not configured on this server. Please contact the administrator.',
          'EMAIL_NOT_CONFIGURED'
        );
      }
      logger.warn(`[mail] SMTP not configured — password reset link for ${to}:\n        ${url}`);
      return { delivered: false, devResetUrl: url };
    }

    const html = layout(
      'Reset your password',
      `<p style="line-height:1.6;color:#c9c3dc">Hi ${escapeHtml(name)},</p>
       <p style="line-height:1.6;color:#c9c3dc">We received a request to reset your password. This link expires in ${minutes} minutes and can be used once.</p>
       <p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Reset password</a></p>
       <p style="line-height:1.6;color:#8c85a3;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`
    );

    try {
      await transporter.sendMail({
        from: config.mail.from,
        to,
        subject: `Reset your ${config.appName} password`,
        text: `Hi ${name},\n\nReset your password using this link (valid for ${minutes} minutes):\n${url}\n\nIf you didn't request this, ignore this email.`,
        html,
      });
    } catch (err) {
      logger.error('[mail] Failed to send password reset email:', err.message);
      throw AppError.unavailable('We could not send the reset email right now. Please try again shortly.', 'EMAIL_SEND_FAILED');
    }
    return { delivered: true };
  },

  async sendPasswordChanged({ to, name }) {
    if (!transporter) return;
    const html = layout(
      'Your password was changed',
      `<p style="line-height:1.6;color:#c9c3dc">Hi ${escapeHtml(name)}, the password for your account was just changed. All other sessions were signed out.</p>
       <p style="line-height:1.6;color:#8c85a3;font-size:13px">If this wasn't you, reset your password immediately and contact support.</p>`
    );
    await transporter
      .sendMail({ from: config.mail.from, to, subject: `Your ${config.appName} password was changed`, html })
      .catch((err) => logger.warn('[mail] Password-changed notice failed:', err.message));
  },
};
