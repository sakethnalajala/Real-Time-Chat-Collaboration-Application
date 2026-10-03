import { presence } from '../sockets/presence.js';
import { idOf, truncate } from './helpers.js';

/** Fields that are safe to show any authenticated user. Never includes email or secrets. */
export const PUBLIC_USER_FIELDS = 'fullName username avatar bio role lastSeen createdAt status';

export const PARTICIPANT_POPULATE = { path: 'participants.user', select: PUBLIC_USER_FIELDS };

export const MESSAGE_POPULATE = [
  { path: 'sender', select: PUBLIC_USER_FIELDS },
  {
    path: 'replyTo',
    select: 'sender type content attachments isDeleted createdAt',
    populate: { path: 'sender', select: 'fullName username' },
  },
];

const isPopulated = (value) => value && typeof value === 'object' && 'username' in value;

export function publicUser(user) {
  if (!user) return null;
  if (!isPopulated(user)) return { _id: idOf(user) };
  const id = idOf(user);
  return {
    _id: id,
    fullName: user.fullName,
    username: user.username,
    avatarUrl: user.avatar?.url || null,
    bio: user.bio || '',
    role: user.role,
    isOnline: user.status === 'suspended' ? false : presence.isOnline(id),
    lastSeen: user.lastSeen || null,
    createdAt: user.createdAt,
  };
}

/** The signed-in user's own profile (includes email and settings, never secrets). */
export function selfUser(user) {
  if (!user) return null;
  return {
    ...publicUser(user),
    email: user.email,
    status: user.status,
    isDemo: Boolean(user.isDemo),
    settings: {
      theme: user.settings?.theme ?? 'dark',
      desktopNotifications: user.settings?.desktopNotifications ?? false,
      sound: user.settings?.sound ?? true,
      messagePreviews: user.settings?.messagePreviews ?? true,
    },
    passwordChangedAt: user.passwordChangedAt || null,
    updatedAt: user.updatedAt,
  };
}

/** Admin view of a user. */
export function adminUser(user) {
  if (!user) return null;
  return {
    ...selfUser(user),
    statusReason: user.statusReason || '',
    statusChangedAt: user.statusChangedAt || null,
  };
}

export function serializeAttachment(a) {
  return {
    _id: idOf(a),
    kind: a.kind,
    url: a.url,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    width: a.width ?? null,
    height: a.height ?? null,
  };
}

function serializeReply(reply) {
  if (!reply) return null;
  if (!reply.createdAt) return { _id: idOf(reply), missing: true };
  const first = reply.attachments?.[0];
  return {
    _id: idOf(reply),
    sender: reply.sender
      ? { _id: idOf(reply.sender), fullName: reply.sender.fullName, username: reply.sender.username }
      : null,
    type: reply.type,
    isDeleted: Boolean(reply.isDeleted),
    content: reply.isDeleted ? '' : truncate(reply.content, 240),
    attachment: !reply.isDeleted && first ? { kind: first.kind, name: first.name, url: first.url } : null,
    attachmentCount: reply.isDeleted ? 0 : reply.attachments?.length || 0,
    createdAt: reply.createdAt,
  };
}

export function serializeMessage(message) {
  if (!message) return null;
  const m = typeof message.toObject === 'function' ? message.toObject({ depopulate: false }) : message;
  return {
    _id: idOf(m),
    conversation: idOf(m.conversation),
    sender: m.sender ? publicUser(m.sender) : null,
    type: m.type,
    content: m.isDeleted ? '' : m.content,
    attachments: m.isDeleted ? [] : (m.attachments || []).map(serializeAttachment),
    replyTo: m.isDeleted ? null : serializeReply(m.replyTo),
    clientMsgId: m.clientMsgId || null,
    editedAt: m.editedAt || null,
    isDeleted: Boolean(m.isDeleted),
    moderated: Boolean(m.moderated),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function serializeConversation(conversation) {
  if (!conversation) return null;
  const c = conversation;
  return {
    _id: idOf(c),
    type: c.type,
    group: c.group
      ? {
          name: c.group.name,
          description: c.group.description || '',
          avatarUrl: c.group.avatar?.url || null,
        }
      : null,
    createdBy: idOf(c.createdBy),
    participants: (c.participants || [])
      .filter((p) => p.user)
      .map((p) => ({
        user: publicUser(p.user),
        role: p.role,
        joinedAt: p.joinedAt,
        lastReadAt: p.lastReadAt || null,
        lastDeliveredAt: p.lastDeliveredAt || null,
        unreadCount: p.unreadCount || 0,
        clearedAt: p.clearedAt || null,
      })),
    lastMessage: c.lastMessage
      ? {
          _id: idOf(c.lastMessage._id),
          sender: idOf(c.lastMessage.sender),
          senderName: c.lastMessage.senderName,
          type: c.lastMessage.type,
          preview: c.lastMessage.preview,
          isDeleted: Boolean(c.lastMessage.isDeleted),
          createdAt: c.lastMessage.createdAt,
        }
      : null,
    lastMessageAt: c.lastMessageAt || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function serializeNotification(n) {
  if (!n) return null;
  return {
    _id: idOf(n),
    type: n.type,
    actor: n.actor ? publicUser(n.actor) : null,
    conversation: idOf(n.conversation),
    message: idOf(n.message),
    report: idOf(n.report),
    title: n.title,
    body: n.body,
    link: n.link,
    count: n.count,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

export function previewFor(message) {
  if (message.isDeleted) return 'This message was deleted';
  const text = truncate(message.content, 100);
  if (message.type === 'image') {
    const label = message.attachments?.length > 1 ? `${message.attachments.length} photos` : 'Photo';
    return text ? `📷 ${text}` : `📷 ${label}`;
  }
  if (message.type === 'file') {
    const name = message.attachments?.[0]?.name || 'File';
    return text ? `📎 ${text}` : `📎 ${truncate(name, 60)}`;
  }
  return text;
}
