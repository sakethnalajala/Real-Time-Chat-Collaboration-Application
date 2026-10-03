import { z } from 'zod';
import { LIMITS, REPORT_ACTIONS, REPORT_REASONS, REPORT_STATUS, REPORT_TARGETS } from '../utils/constants.js';
import { bio, booleanish, email, fullName, idArray, limit, objectId, optionalObjectId, page, password, username } from './common.js';

const confirmMatches = (field) => (data, ctx) => {
  if (data[field] !== data.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  }
};

/* ------------------------------ auth ------------------------------ */

export const registerBody = z
  .object({
    fullName,
    username,
    email,
    password,
    confirmPassword: z.string({ error: 'Please confirm your password' }).min(1, 'Please confirm your password'),
  })
  .superRefine(confirmMatches('password'));

export const loginBody = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128),
});

export const demoLoginBody = z.object({ account: z.enum(['user1', 'user2', 'user3', 'admin'], { error: 'Unknown demo account' }) });

export const forgotPasswordBody = z.object({ email });

export const resetTokenParams = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i, 'This reset link is invalid or has expired'),
});

export const resetPasswordBody = z
  .object({ password, confirmPassword: z.string({ error: 'Please confirm your password' }) })
  .superRefine(confirmMatches('password'));

export const changePasswordBody = z
  .object({
    currentPassword: z.string({ error: 'Current password is required' }).min(1, 'Current password is required').max(128),
    newPassword: password,
    confirmPassword: z.string({ error: 'Please confirm your new password' }),
  })
  .superRefine(confirmMatches('newPassword'));

/* ------------------------------ users ----------------------------- */

export const searchUsersQuery = z.object({
  q: z.string().trim().max(50).default(''),
  page,
  limit: limit(50, 20),
});

export const userParams = z.object({ id: z.string().trim().min(1).max(40) });

export const updateMeBody = z
  .object({
    fullName: fullName.optional(),
    username: username.optional(),
    bio: bio.optional(),
    settings: z
      .object({
        theme: z.enum(['dark', 'light', 'system']).optional(),
        desktopNotifications: z.boolean().optional(),
        sound: z.boolean().optional(),
        messagePreviews: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), { message: 'Nothing to update' });

/* -------------------------- conversations ------------------------- */

export const listConversationsQuery = z.object({ q: z.string().trim().max(60).optional() });

export const directBody = z.object({ userId: objectId });

const groupName = z
  .string({ error: 'Group name is required' })
  .trim()
  .min(1, 'Group name is required')
  .max(LIMITS.GROUP_NAME_MAX_LENGTH, `Group name must be at most ${LIMITS.GROUP_NAME_MAX_LENGTH} characters`);
const groupDescription = z.string().trim().max(LIMITS.GROUP_DESCRIPTION_MAX_LENGTH, 'Description is too long');

export const createGroupBody = z.object({
  name: groupName,
  description: groupDescription.default(''),
  memberIds: idArray(1, LIMITS.GROUP_MAX_MEMBERS - 1),
});

export const updateGroupBody = z.object({
  name: groupName.optional(),
  description: groupDescription.optional(),
  removeImage: booleanish.optional(),
});

export const addMembersBody = z.object({ userIds: idArray(1, LIMITS.GROUP_MAX_MEMBERS - 1) });

export const memberParams = z.object({ id: objectId, userId: objectId });

export const memberRoleBody = z.object({ role: z.enum(['admin', 'member'], { error: 'Role must be admin or member' }) });

/* ---------------------------- messages ---------------------------- */

export const listMessagesQuery = z.object({
  before: optionalObjectId,
  after: optionalObjectId,
  limit: limit(100, 30),
});

export const sendMessageBody = z.object({
  content: z.string().max(LIMITS.MESSAGE_MAX_LENGTH, `Messages can be at most ${LIMITS.MESSAGE_MAX_LENGTH} characters`).default(''),
  replyTo: optionalObjectId,
  clientMsgId: z
    .string()
    .max(64)
    .regex(/^[\w-]+$/, 'Invalid client message id')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const editMessageBody = z.object({
  content: z.string({ error: 'Message content is required' }).max(LIMITS.MESSAGE_MAX_LENGTH, `Messages can be at most ${LIMITS.MESSAGE_MAX_LENGTH} characters`),
});

export const deleteMessageQuery = z.object({ scope: z.enum(['me', 'everyone']).default('me') });

/* -------------------------- notifications ------------------------- */

export const listNotificationsQuery = z.object({ page, limit: limit(50, 20), unread: booleanish.optional() });

/* ----------------------------- reports ---------------------------- */

export const createReportBody = z.object({
  targetType: z.enum(Object.values(REPORT_TARGETS), { error: 'Choose what you are reporting' }),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS, { error: 'Choose a reason' }),
  details: z.string().trim().max(1000, 'Details must be at most 1000 characters').default(''),
});

/* ------------------------------ admin ----------------------------- */

export const adminUsersQuery = z.object({
  q: z.string().trim().max(80).default(''),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page,
  limit: limit(100, 20),
});

export const adminUserStatusBody = z.object({
  status: z.enum(['active', 'suspended'], { error: 'Status must be active or suspended' }),
  reason: z.string().trim().max(300, 'Reason must be at most 300 characters').default(''),
});

export const adminUpdateUserBody = z
  .object({
    fullName: fullName.optional(),
    username: username.optional(),
    bio: bio.optional(),
    removeAvatar: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), { message: 'Nothing to update' });

export const adminConversationsQuery = z.object({
  q: z.string().trim().max(80).default(''),
  type: z.enum(['direct', 'group']).optional(),
  page,
  limit: limit(100, 20),
});

export const adminReportsQuery = z.object({
  status: z.enum(Object.values(REPORT_STATUS)).optional(),
  targetType: z.enum(Object.values(REPORT_TARGETS)).optional(),
  page,
  limit: limit(50, 20),
});

export const adminUpdateReportBody = z.object({
  status: z.enum([REPORT_STATUS.REVIEWING, REPORT_STATUS.RESOLVED, REPORT_STATUS.DISMISSED], { error: 'Choose a valid status' }),
  action: z.enum(REPORT_ACTIONS).default('none'),
  note: z.string().trim().max(1000, 'Note must be at most 1000 characters').default(''),
});

export const adminRemoveMessageBody = z.object({ reason: z.string().trim().max(300).default('') });

export const paginationQuery = z.object({ page, limit: limit(100, 30) });
