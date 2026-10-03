import { Conversation, Message, Notification, User, directKeyFor } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { idOf, sameId, uniqueIds } from '../utils/helpers.js';
import { PARTICIPANT_POPULATE, serializeConversation } from '../utils/serializers.js';
import { CONVERSATION_TYPES, LIMITS, MEMBER_ROLES, MESSAGE_TYPES, NOTIFICATION_TYPES, USER_STATUS } from '../utils/constants.js';
import { emitToUser, emitToUsers } from '../sockets/emitter.js';
import { invalidateMembers } from '../sockets/membershipCache.js';
import { getConversationForMember, participantIds, requireGroup, requireGroupAdmin, requireGroupOwner, roleOf } from './access.js';
import { createMessage } from './messageCore.js';
import { markConversationRead, notify, notifyMany } from './notification.service.js';
import { storage } from './storage/index.js';

const firstName = (user) => user.fullName.split(' ')[0];
const joinNames = (users) => {
  const names = users.map((u) => u.fullName);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

async function loadSerialized(conversationId) {
  const conversation = await Conversation.findById(conversationId).populate(PARTICIPANT_POPULATE);
  return serializeConversation(conversation);
}

const systemMessage = (conversation, content) =>
  createMessage({ conversation, sender: null, type: MESSAGE_TYPES.SYSTEM, content });

/** A direct conversation is listed once it has messages (or for the person who opened it). */
function isVisibleTo(conversation, userId) {
  if (conversation.type === CONVERSATION_TYPES.GROUP) return true;
  const me = conversation.getParticipant(userId);
  if (!conversation.lastMessageAt) return sameId(conversation.createdBy, userId) && !me?.clearedAt;
  if (me?.clearedAt && conversation.lastMessageAt <= me.clearedAt) return false;
  return true;
}

export async function listConversations(userId, { q } = {}) {
  const conversations = await Conversation.find({ 'participants.user': userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(500)
    .populate(PARTICIPANT_POPULATE);

  let visible = conversations.filter((c) => isVisibleTo(c, userId));

  const needle = q?.trim().toLowerCase();
  if (needle) {
    visible = visible.filter((c) => {
      if (c.type === CONVERSATION_TYPES.GROUP) return c.group?.name?.toLowerCase().includes(needle);
      return c.participants.some(
        (p) =>
          p.user &&
          !sameId(p.user, userId) &&
          (p.user.fullName.toLowerCase().includes(needle) || p.user.username.includes(needle))
      );
    });
  }

  // Conversations without messages (just-created) sort by creation time.
  visible.sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
  return visible.map(serializeConversation);
}

export async function getConversation(userId, conversationId) {
  const conversation = await getConversationForMember(conversationId, userId, { populate: true });
  return serializeConversation(conversation);
}

export async function openDirectConversation(me, otherUserId) {
  if (sameId(me._id, otherUserId)) throw AppError.badRequest("You can't start a conversation with yourself");

  const other = await User.findById(otherUserId).select('status');
  if (!other) throw AppError.notFound('User not found');
  if (other.status !== USER_STATUS.ACTIVE) throw AppError.forbidden('This user is not available');

  const directKey = directKeyFor(me._id, other._id);
  let conversation = await Conversation.findOne({ directKey });
  let created = false;

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: CONVERSATION_TYPES.DIRECT,
        directKey,
        createdBy: me._id,
        participants: [
          { user: me._id, role: MEMBER_ROLES.MEMBER },
          { user: other._id, role: MEMBER_ROLES.MEMBER },
        ],
      });
      created = true;
    } catch (err) {
      if (err.code !== 11000) throw err;
      conversation = await Conversation.findOne({ directKey }); // created concurrently
    }
  } else {
    const mine = conversation.getParticipant(me._id);
    if (mine?.clearedAt && !conversation.lastMessageAt) {
      // Re-opening a cleared empty chat makes it visible again for the opener.
      conversation.createdBy = me._id;
      mine.clearedAt = null;
      await conversation.save();
    }
  }

  await conversation.populate(PARTICIPANT_POPULATE);
  return { conversation: serializeConversation(conversation), created };
}

export async function createGroup(me, { name, description = '', memberIds }, imageFile) {
  const ids = uniqueIds(memberIds).filter((id) => !sameId(id, me._id));
  if (ids.length < 1) throw AppError.badRequest('Add at least one member to create a group', [{ path: 'memberIds', message: 'Select at least one member' }]);
  if (ids.length + 1 > LIMITS.GROUP_MAX_MEMBERS) throw AppError.badRequest(`A group can have at most ${LIMITS.GROUP_MAX_MEMBERS} members`);

  const members = await User.find({ _id: { $in: ids }, status: USER_STATUS.ACTIVE }).select('_id fullName');
  if (members.length !== ids.length) throw AppError.badRequest('Some selected users are no longer available');

  const avatar = imageFile ? await storage.upload(imageFile, { folder: 'groups', kind: 'image', variant: 'avatar' }) : null;
  const now = new Date();

  let conversation;
  try {
    conversation = await Conversation.create({
      type: CONVERSATION_TYPES.GROUP,
      createdBy: me._id,
      group: {
        name,
        description,
        avatar: avatar ? { url: avatar.url, publicId: avatar.publicId, provider: avatar.provider } : null,
      },
      participants: [
        { user: me._id, role: MEMBER_ROLES.OWNER, joinedAt: now, lastReadAt: now, lastDeliveredAt: now },
        ...members.map((m) => ({ user: m._id, role: MEMBER_ROLES.MEMBER, joinedAt: now })),
      ],
    });
  } catch (err) {
    if (avatar) storage.remove(avatar);
    throw err;
  }

  emitToUsers(participantIds(conversation), 'conversation:new', { conversation: await loadSerialized(conversation._id) });
  await systemMessage(conversation, `${me.fullName} created the group "${name}"`);

  await notifyMany(ids, {
    type: NOTIFICATION_TYPES.GROUP_ADDED,
    actor: me._id,
    conversation: conversation._id,
    title: name,
    body: `${me.fullName} added you to the group`,
    link: `/chats/${conversation._id}`,
  });

  return loadSerialized(conversation._id);
}

export async function updateGroup(me, conversationId, { name, description, removeImage }, imageFile) {
  const conversation = await getConversationForMember(conversationId, me._id);
  requireGroupAdmin(conversation, me._id);

  const events = [];
  const previousAvatar = conversation.group.avatar;

  if (name !== undefined && name !== conversation.group.name) {
    conversation.group.name = name;
    events.push(`${me.fullName} renamed the group to "${name}"`);
  }
  if (description !== undefined && description !== conversation.group.description) {
    conversation.group.description = description;
    events.push(`${me.fullName} updated the group description`);
  }

  let uploaded = null;
  if (imageFile) {
    uploaded = await storage.upload(imageFile, { folder: 'groups', kind: 'image', variant: 'avatar' });
    conversation.group.avatar = { url: uploaded.url, publicId: uploaded.publicId, provider: uploaded.provider };
    events.push(`${me.fullName} changed the group photo`);
  } else if (removeImage && previousAvatar) {
    conversation.group.avatar = null;
    events.push(`${me.fullName} removed the group photo`);
  }

  if (!events.length) return loadSerialized(conversation._id);

  try {
    await conversation.save();
  } catch (err) {
    if (uploaded) storage.remove(uploaded);
    throw err;
  }
  if ((uploaded || removeImage) && previousAvatar) storage.remove(previousAvatar);

  for (const text of events) await systemMessage(conversation, text);
  const serialized = await loadSerialized(conversation._id);
  emitToUsers(participantIds(conversation), 'conversation:updated', { conversation: serialized });
  return serialized;
}

export async function addMembers(me, conversationId, userIds) {
  const conversation = await getConversationForMember(conversationId, me._id);
  requireGroupAdmin(conversation, me._id);

  const existing = new Set(participantIds(conversation));
  const ids = uniqueIds(userIds).filter((id) => !existing.has(id));
  if (!ids.length) throw AppError.badRequest('Those users are already in the group');
  if (existing.size + ids.length > LIMITS.GROUP_MAX_MEMBERS) {
    throw AppError.badRequest(`A group can have at most ${LIMITS.GROUP_MAX_MEMBERS} members`);
  }

  const users = await User.find({ _id: { $in: ids }, status: USER_STATUS.ACTIVE }).select('_id fullName');
  if (users.length !== ids.length) throw AppError.badRequest('Some selected users are no longer available');

  const now = new Date();
  conversation.participants.push(...users.map((u) => ({ user: u._id, role: MEMBER_ROLES.MEMBER, joinedAt: now })));
  await conversation.save();
  invalidateMembers(conversation._id);

  const serialized = await loadSerialized(conversation._id);
  emitToUsers(ids, 'conversation:new', { conversation: serialized });
  emitToUsers([...existing], 'conversation:updated', { conversation: serialized });
  await systemMessage(conversation, `${me.fullName} added ${joinNames(users)}`);

  await notifyMany(ids, {
    type: NOTIFICATION_TYPES.GROUP_ADDED,
    actor: me._id,
    conversation: conversation._id,
    title: conversation.group.name,
    body: `${me.fullName} added you to the group`,
    link: `/chats/${conversation._id}`,
  });

  return loadSerialized(conversation._id);
}

export async function removeMember(me, conversationId, targetUserId) {
  if (sameId(me._id, targetUserId)) return leaveGroup(me, conversationId);

  const conversation = await getConversationForMember(conversationId, me._id);
  const myRole = requireGroupAdmin(conversation, me._id);
  const target = conversation.getParticipant(targetUserId);
  if (!target) throw AppError.notFound('That user is not a member of this group');
  if (target.role === MEMBER_ROLES.OWNER) throw AppError.forbidden('The group owner cannot be removed');
  if (target.role === MEMBER_ROLES.ADMIN && myRole !== MEMBER_ROLES.OWNER) {
    throw AppError.forbidden('Only the group owner can remove an admin');
  }

  const targetUser = await User.findById(targetUserId).select('fullName');
  conversation.participants = conversation.participants.filter((p) => !sameId(p.user, targetUserId));
  await conversation.save();
  invalidateMembers(conversation._id);

  emitToUser(targetUserId, 'conversation:removed', { conversationId: idOf(conversation), reason: 'removed' });
  await systemMessage(conversation, `${me.fullName} removed ${targetUser?.fullName ?? 'a member'}`);
  const serialized = await loadSerialized(conversation._id);
  emitToUsers(participantIds(conversation), 'conversation:updated', { conversation: serialized });

  await notify(targetUserId, {
    type: NOTIFICATION_TYPES.GROUP_REMOVED,
    actor: me._id,
    conversation: conversation._id,
    title: conversation.group.name,
    body: `${me.fullName} removed you from the group`,
  });
  return { conversation: serialized };
}

export async function changeMemberRole(me, conversationId, targetUserId, role) {
  const conversation = await getConversationForMember(conversationId, me._id);
  requireGroupOwner(conversation, me._id);
  if (sameId(me._id, targetUserId)) throw AppError.badRequest('You cannot change your own role');

  const target = conversation.getParticipant(targetUserId);
  if (!target) throw AppError.notFound('That user is not a member of this group');
  if (target.role === role) return loadSerialized(conversation._id);

  target.role = role;
  await conversation.save();

  const targetUser = await User.findById(targetUserId).select('fullName');
  const text =
    role === MEMBER_ROLES.ADMIN
      ? `${me.fullName} made ${targetUser.fullName} an admin`
      : `${me.fullName} removed ${targetUser.fullName} as admin`;
  await systemMessage(conversation, text);

  const serialized = await loadSerialized(conversation._id);
  emitToUsers(participantIds(conversation), 'conversation:updated', { conversation: serialized });
  await notify(targetUserId, {
    type: NOTIFICATION_TYPES.GROUP_ROLE,
    actor: me._id,
    conversation: conversation._id,
    title: conversation.group.name,
    body: role === MEMBER_ROLES.ADMIN ? `${firstName(me)} made you a group admin` : `${firstName(me)} removed your admin role`,
    link: `/chats/${conversation._id}`,
  });
  return serialized;
}

async function destroyGroup(conversation) {
  const messages = await Message.find({ conversation: conversation._id, 'attachments.0': { $exists: true } }).select('attachments');
  const files = messages.flatMap((m) => m.attachments.map((a) => a.toObject()));
  if (conversation.group?.avatar) files.push(conversation.group.avatar.toObject?.() ?? conversation.group.avatar);

  await Promise.all([
    Message.deleteMany({ conversation: conversation._id }),
    Notification.deleteMany({ conversation: conversation._id }),
  ]);
  await Conversation.deleteOne({ _id: conversation._id });
  invalidateMembers(conversation._id);
  storage.removeMany(files);
}

export async function leaveGroup(me, conversationId) {
  const conversation = await getConversationForMember(conversationId, me._id);
  requireGroup(conversation);

  const leaving = conversation.getParticipant(me._id);
  conversation.participants = conversation.participants.filter((p) => !sameId(p.user, me._id));
  emitToUser(me._id, 'conversation:removed', { conversationId: idOf(conversation), reason: 'left' });

  if (!conversation.participants.length) {
    await destroyGroup(conversation);
    return { left: true, deleted: true };
  }

  let newOwner = null;
  if (leaving.role === MEMBER_ROLES.OWNER) {
    const byJoin = (a, b) => a.joinedAt - b.joinedAt;
    newOwner =
      conversation.participants.filter((p) => p.role === MEMBER_ROLES.ADMIN).sort(byJoin)[0] ||
      [...conversation.participants].sort(byJoin)[0];
    newOwner.role = MEMBER_ROLES.OWNER;
  }
  await conversation.save();
  invalidateMembers(conversation._id);

  await systemMessage(conversation, `${me.fullName} left the group`);
  if (newOwner) {
    const owner = await User.findById(newOwner.user).select('fullName');
    await systemMessage(conversation, `${owner.fullName} is now the group owner`);
  }
  emitToUsers(participantIds(conversation), 'conversation:updated', { conversation: await loadSerialized(conversation._id) });
  return { left: true, deleted: false };
}

/** Groups: owner deletes for everyone. Direct chats: clears the history for the requester only. */
export async function deleteConversation(me, conversationId) {
  const conversation = await getConversationForMember(conversationId, me._id);

  if (conversation.type === CONVERSATION_TYPES.GROUP) {
    if (roleOf(conversation, me._id) !== MEMBER_ROLES.OWNER) {
      throw AppError.forbidden('Only the group owner can delete the group. You can leave it instead.');
    }
    const members = participantIds(conversation);
    await destroyGroup(conversation);
    emitToUsers(members, 'conversation:removed', { conversationId: idOf(conversation), reason: 'deleted' });
    await notifyMany(
      members.filter((id) => !sameId(id, me._id)),
      { type: NOTIFICATION_TYPES.GROUP_REMOVED, actor: me._id, title: conversation.group.name, body: `${me.fullName} deleted the group` }
    );
    return { deleted: true };
  }

  const now = new Date();
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': me._id },
    { $set: { 'participants.$.clearedAt': now, 'participants.$.unreadCount': 0, 'participants.$.lastReadAt': now } }
  );
  await markConversationRead(me._id, conversation._id);
  emitToUser(me._id, 'conversation:removed', { conversationId: idOf(conversation), reason: 'cleared' });
  return { cleared: true };
}

/* ----------------------------- receipts ----------------------------- */

export async function markRead(userId, conversationId) {
  const now = new Date();
  const before = await Conversation.findOneAndUpdate(
    { _id: conversationId, 'participants.user': userId },
    {
      $set: {
        'participants.$.lastReadAt': now,
        'participants.$.lastDeliveredAt': now,
        'participants.$.unreadCount': 0,
      },
    },
    { returnDocument: 'before', projection: { participants: 1, lastMessageAt: 1 } }
  );
  if (!before) throw AppError.notFound('Conversation not found');

  const mine = before.getParticipant(userId);
  const hadUnseen = mine.unreadCount > 0 || !mine.lastReadAt || (before.lastMessageAt && mine.lastReadAt < before.lastMessageAt);
  if (hadUnseen) {
    emitToUsers(participantIds(before), 'receipt:update', {
      conversationId: idOf(before),
      userId: String(userId),
      type: 'read',
      at: now,
    });
  }
  await markConversationRead(userId, conversationId);
  return { conversationId: idOf(before), readAt: now };
}

export async function markDelivered(userId, conversationId, messageId) {
  const message = await Message.findOne({ _id: messageId, conversation: conversationId }).select('createdAt');
  if (!message) return null;

  const result = await Conversation.updateOne(
    {
      _id: conversationId,
      participants: {
        $elemMatch: { user: userId, $or: [{ lastDeliveredAt: null }, { lastDeliveredAt: { $lt: message.createdAt } }] },
      },
    },
    { $set: { 'participants.$.lastDeliveredAt': message.createdAt } }
  );

  if (result.modifiedCount) {
    const conversation = await Conversation.findById(conversationId).select('participants.user');
    emitToUsers(participantIds(conversation), 'receipt:update', {
      conversationId: String(conversationId),
      userId: String(userId),
      type: 'delivered',
      at: message.createdAt,
    });
  }
  return message.createdAt;
}

/** Called when a user connects: everything sent while they were offline is now delivered. */
export async function markAllDelivered(userId) {
  const conversations = await Conversation.find({ 'participants.user': userId, lastMessageAt: { $ne: null } }).select(
    'participants lastMessageAt'
  );

  const pending = conversations.filter((c) => {
    const mine = c.getParticipant(userId);
    return mine && (!mine.lastDeliveredAt || mine.lastDeliveredAt < c.lastMessageAt);
  });
  if (!pending.length) return;

  await Conversation.bulkWrite(
    pending.map((c) => ({
      updateOne: {
        filter: { _id: c._id, 'participants.user': userId },
        update: { $set: { 'participants.$.lastDeliveredAt': c.lastMessageAt } },
      },
    }))
  );

  for (const c of pending) {
    emitToUsers(participantIds(c), 'receipt:update', {
      conversationId: idOf(c),
      userId: String(userId),
      type: 'delivered',
      at: c.lastMessageAt,
    });
  }
}
