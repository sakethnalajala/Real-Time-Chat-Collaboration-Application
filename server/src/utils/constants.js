export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

export const USER_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' });

export const CONVERSATION_TYPES = Object.freeze({ DIRECT: 'direct', GROUP: 'group' });

export const MEMBER_ROLES = Object.freeze({ OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' });

export const MESSAGE_TYPES = Object.freeze({ TEXT: 'text', IMAGE: 'image', FILE: 'file', SYSTEM: 'system' });

export const NOTIFICATION_TYPES = Object.freeze({
  MESSAGE: 'message',
  GROUP_ADDED: 'group_added',
  GROUP_REMOVED: 'group_removed',
  GROUP_ROLE: 'group_role',
  REPORT_NEW: 'report_new',
  REPORT_UPDATE: 'report_update',
  ACCOUNT: 'account',
});

export const REPORT_TARGETS = Object.freeze({ USER: 'user', MESSAGE: 'message', CONVERSATION: 'conversation' });

export const REPORT_REASONS = Object.freeze(['spam', 'harassment', 'hate_speech', 'inappropriate_content', 'impersonation', 'other']);

export const REPORT_STATUS = Object.freeze({
  OPEN: 'open',
  REVIEWING: 'reviewing',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

export const REPORT_ACTIONS = Object.freeze(['none', 'warned', 'message_removed', 'user_suspended']);

export const LIMITS = Object.freeze({
  MESSAGE_MAX_LENGTH: 4000,
  BIO_MAX_LENGTH: 160,
  GROUP_NAME_MAX_LENGTH: 60,
  GROUP_DESCRIPTION_MAX_LENGTH: 300,
  GROUP_MAX_MEMBERS: 100,
});

/** Allowed upload types: declared MIME → expected detected MIME (null = text, no magic bytes). */
export const ATTACHMENT_TYPES = Object.freeze({
  'image/jpeg': { kind: 'image', detect: ['image/jpeg'] },
  'image/png': { kind: 'image', detect: ['image/png'] },
  'image/webp': { kind: 'image', detect: ['image/webp'] },
  'image/gif': { kind: 'image', detect: ['image/gif'] },
  'application/pdf': { kind: 'file', detect: ['application/pdf'] },
  'text/plain': { kind: 'file', detect: null },
  'text/csv': { kind: 'file', detect: null },
  'application/zip': { kind: 'file', detect: ['application/zip'] },
  'application/x-zip-compressed': { kind: 'file', detect: ['application/zip'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    kind: 'file',
    detect: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    kind: 'file',
    detect: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    kind: 'file',
    detect: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
  },
});

export const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
