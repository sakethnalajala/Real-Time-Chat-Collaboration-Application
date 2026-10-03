import { z } from 'zod';

/* Client-side mirrors of the API validation rules (the server remains the source of truth). */

export const emailField = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');

export const passwordField = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number');

export const usernameField = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, underscores and dots only');

export const fullNameField = z.string().trim().min(2, 'At least 2 characters').max(60, 'At most 60 characters');

const matchConfirm = (field) => (data) => data[field] === data.confirmPassword;
const confirmIssue = { message: 'Passwords do not match', path: ['confirmPassword'] };

export const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Password is required') });

export const registerSchema = z
  .object({
    fullName: fullNameField,
    username: usernameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(matchConfirm('password'), confirmIssue);

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z
  .object({ password: passwordField, confirmPassword: z.string().min(1, 'Please confirm your password') })
  .refine(matchConfirm('password'), confirmIssue);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine(matchConfirm('newPassword'), confirmIssue)
  .refine((d) => d.currentPassword !== d.newPassword, { message: 'Choose a different password', path: ['newPassword'] });

export const profileSchema = z.object({
  fullName: fullNameField,
  username: usernameField,
  bio: z.string().trim().max(160, 'At most 160 characters'),
});

/** 0–4 strength score for the password meter. */
export function passwordStrength(password = '') {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
}
