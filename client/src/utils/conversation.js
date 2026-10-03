export const getMyState = (conversation, meId) => conversation?.participants?.find((p) => p.user._id === meId) ?? null;

export const getOtherParticipant = (conversation, meId) =>
  conversation?.participants?.find((p) => p.user._id !== meId) ?? null;

export const getUnreadCount = (conversation, meId) => getMyState(conversation, meId)?.unreadCount ?? 0;

export const isGroup = (conversation) => conversation?.type === 'group';

/** Display name / avatar for a conversation from the viewer's perspective. */
export function getConversationDisplay(conversation, meId) {
  if (!conversation) return { name: '', avatarUrl: null, user: null, isGroup: false };
  if (isGroup(conversation)) {
    return { name: conversation.group?.name || 'Group', avatarUrl: conversation.group?.avatarUrl, user: null, isGroup: true };
  }
  const other = getOtherParticipant(conversation, meId)?.user;
  return { name: other?.fullName || 'Unknown user', avatarUrl: other?.avatarUrl, user: other, isGroup: false };
}

/** The last message, unless the viewer cleared the chat after it. */
export function getVisibleLastMessage(conversation, meId) {
  const last = conversation?.lastMessage;
  if (!last) return null;
  const mine = getMyState(conversation, meId);
  if (mine?.clearedAt && new Date(last.createdAt) <= new Date(mine.clearedAt)) return null;
  return last;
}

export const conversationActivity = (conversation) => new Date(conversation.lastMessageAt || conversation.createdAt).getTime();

export const sortConversations = (list) => [...list].sort((a, b) => conversationActivity(b) - conversationActivity(a));

const truncate = (text = '', max = 100) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/** Mirrors the server's preview format. */
export function previewFor(message) {
  if (message.isDeleted) return 'This message was deleted';
  const text = truncate(message.content);
  if (message.type === 'image') {
    const label = message.attachments?.length > 1 ? `${message.attachments.length} photos` : 'Photo';
    return text ? `📷 ${text}` : `📷 ${label}`;
  }
  if (message.type === 'file') return text ? `📎 ${text}` : `📎 ${truncate(message.attachments?.[0]?.name || 'File', 60)}`;
  return text;
}

/**
 * Tick state for a message I sent, derived from the other members' delivered/read watermarks.
 * Members who joined after the message was sent are ignored.
 */
export function getMessageStatus(message, conversation, meId) {
  if (message.pending) return 'sending';
  if (message.failed) return 'failed';
  if (!conversation) return 'sent';
  const sentAt = new Date(message.createdAt).getTime();
  const others = conversation.participants.filter((p) => p.user._id !== meId && new Date(p.joinedAt).getTime() <= sentAt);
  if (!others.length) return 'sent';
  const reached = (key) => others.every((p) => p[key] && new Date(p[key]).getTime() >= sentAt);
  if (reached('lastReadAt')) return 'read';
  if (reached('lastDeliveredAt')) return 'delivered';
  return 'sent';
}

export const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' };
