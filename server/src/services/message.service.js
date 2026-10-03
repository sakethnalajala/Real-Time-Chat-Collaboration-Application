import { Conversation, Message, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { idOf, isObjectId, sameId } from '../utils/helpers.js';
import { MESSAGE_POPULATE, PARTICIPANT_POPULATE, previewFor, publicUser, serializeMessage } from '../utils/serializers.js';
import { CONVERSATION_TYPES, IMAGE_TYPES, MEMBER_ROLES, MESSAGE_TYPES, USER_STATUS } from '../utils/constants.js';
import { emitToUser, emitToUsers } from '../sockets/emitter.js';
import { getConversationForMember, participantIds, roleOf } from './access.js';
import { createMessage, removeMessageForEveryone } from './messageCore.js';
import { storage } from './storage/index.js';

/**
 * Cursor-paginated history (newest first in storage, returned oldest → newest).
 *  - before: load older messages than this id (infinite scroll up)
 *  - after:  load newer messages than this id (gap fill after a reconnect)
 * Members only see messages after they joined a group and after they cleared a chat.
 */
export async function listMessages(userId, conversationId, { before, after, limit = 30 }) {
  const conversation = await getConversationForMember(conversationId, userId);
  const me = conversation.getParticipant(userId);

  const filter = { conversation: conversation._id, deletedFor: { $ne: userId } };
  const joinedFloor = conversation.type === CONVERSATION_TYPES.GROUP ? me.joinedAt : null;
  if (me.clearedAt && (!joinedFloor || me.clearedAt >= joinedFloor)) filter.createdAt = { $gt: me.clearedAt };
  else if (joinedFloor) filter.createdAt = { $gte: joinedFloor };

  if (before) filter._id = { $lt: before };
  else if (after) filter._id = { $gt: after };

  const docs = await Message.find(filter)
    .sort({ _id: after ? 1 : -1 })
    .limit(limit + 1)
    .populate(MESSAGE_POPULATE);

  const hasMore = docs.length > limit;
  if (hasMore) docs.pop();
  const ordered = after ? docs : docs.reverse();

  return {
    messages: ordered.map(serializeMessage),
    hasMore,
    nextCursor: hasMore && !after && ordered.length ? idOf(ordered[0]) : null,
  };
}

async function assertCanPost(conversation, sender) {
  if (conversation.type !== CONVERSATION_TYPES.DIRECT) return;
  const other = conversation.participants.find((p) => !sameId(p.user, sender._id));
  const otherUser = other ? await User.findById(other.user).select('status') : null;
  if (!otherUser || otherUser.status !== USER_STATUS.ACTIVE) {
    throw AppError.forbidden('This user is no longer available, so you cannot send new messages.', 'RECIPIENT_UNAVAILABLE');
  }
}

export async function sendMessage(sender, conversationId, { content = '', replyTo, clientMsgId }, files = []) {
  const conversation = await getConversationForMember(conversationId, sender._id);
  const text = content.replace(/^\s+|\s+$/g, '');
  if (!text && !files.length) throw AppError.badRequest('Message cannot be empty', [{ path: 'content', message: 'Write a message or attach a file' }]);

  if (clientMsgId) {
    const existing = await Message.findOne({ sender: sender._id, clientMsgId }).populate(MESSAGE_POPULATE);
    if (existing) return serializeMessage(existing); // idempotent retry
  }

  await assertCanPost(conversation, sender);

  let replyId = null;
  if (replyTo) {
    const original = await Message.findOne({ _id: replyTo, conversation: conversation._id }).select('_id');
    if (!original) throw AppError.badRequest('The message you are replying to is no longer available');
    replyId = original._id;
  }

  const uploaded = [];
  try {
    for (const file of files) {
      const kind = IMAGE_TYPES.includes(file.mimetype) ? 'image' : 'file';
      const result = await storage.upload(file, { folder: `messages/${idOf(conversation)}`, kind });
      uploaded.push({
        kind,
        url: result.url,
        publicId: result.publicId,
        provider: result.provider,
        resourceType: result.resourceType,
        name: file.originalname,
        mimeType: file.mimetype,
        size: result.size ?? file.size,
        width: result.width,
        height: result.height,
      });
    }
  } catch (err) {
    storage.removeMany(uploaded);
    throw err;
  }

  const type = uploaded.length
    ? uploaded.every((a) => a.kind === 'image')
      ? MESSAGE_TYPES.IMAGE
      : MESSAGE_TYPES.FILE
    : MESSAGE_TYPES.TEXT;

  try {
    const message = await createMessage({
      conversation,
      sender,
      type,
      content: text,
      attachments: uploaded,
      replyTo: replyId,
      clientMsgId: clientMsgId || undefined,
    });
    return serializeMessage(message);
  } catch (err) {
    storage.removeMany(uploaded);
    if (err.code === 11000 && clientMsgId) {
      const existing = await Message.findOne({ sender: sender._id, clientMsgId }).populate(MESSAGE_POPULATE);
      if (existing) return serializeMessage(existing);
    }
    throw err;
  }
}

async function loadMessageForMember(messageId, userId) {
  if (!isObjectId(messageId)) throw AppError.notFound('Message not found');
  const message = await Message.findById(messageId);
  if (!message || message.deletedFor.some((id) => sameId(id, userId))) throw AppError.notFound('Message not found');
  const conversation = await getConversationForMember(message.conversation, userId);
  return { message, conversation };
}

export async function editMessage(user, messageId, content) {
  const { message, conversation } = await loadMessageForMember(messageId, user._id);
  if (!sameId(message.sender, user._id)) throw AppError.forbidden('You can only edit your own messages');
  if (message.isDeleted) throw AppError.badRequest('Deleted messages cannot be edited');
  if (message.type === MESSAGE_TYPES.SYSTEM) throw AppError.forbidden('System messages cannot be edited');

  const text = content.replace(/^\s+|\s+$/g, '');
  if (!text && !message.attachments.length) throw AppError.badRequest('Message cannot be empty', [{ path: 'content', message: 'Message cannot be empty' }]);

  if (text !== message.content) {
    message.content = text;
    message.editedAt = new Date();
    await message.save();
    await Conversation.updateOne(
      { _id: conversation._id, 'lastMessage._id': message._id },
      { $set: { 'lastMessage.preview': previewFor(message) } }
    );
  }

  await message.populate(MESSAGE_POPULATE);
  const serialized = serializeMessage(message);
  emitToUsers(participantIds(conversation), 'message:updated', { conversationId: idOf(conversation), message: serialized });
  return serialized;
}

export async function deleteMessage(user, messageId, scope = 'me') {
  const { message, conversation } = await loadMessageForMember(messageId, user._id);

  if (scope === 'me') {
    await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: user._id } });
    emitToUser(user._id, 'message:deleted', { conversationId: idOf(conversation), messageId: idOf(message), scope: 'me' });
    return { messageId: idOf(message), scope: 'me' };
  }

  const isSender = sameId(message.sender, user._id);
  const role = roleOf(conversation, user._id);
  const isGroupModerator =
    conversation.type === CONVERSATION_TYPES.GROUP && (role === MEMBER_ROLES.OWNER || role === MEMBER_ROLES.ADMIN);

  if (message.type === MESSAGE_TYPES.SYSTEM) throw AppError.forbidden('System messages cannot be deleted for everyone');
  if (!isSender && !isGroupModerator) throw AppError.forbidden('You can only delete your own messages for everyone');

  const deleted = await removeMessageForEveryone(message, { by: user._id, conversation });
  return { messageId: idOf(deleted), scope: 'everyone', message: serializeMessage(deleted) };
}

/** Delivery / read status per member, derived from the conversation watermarks. Sender only. */
export async function getMessageInfo(user, messageId) {
  const { message } = await loadMessageForMember(messageId, user._id);
  if (!sameId(message.sender, user._id)) throw AppError.forbidden('Message info is only available for your own messages');

  const conversation = await Conversation.findById(message.conversation).populate(PARTICIPANT_POPULATE);
  await message.populate(MESSAGE_POPULATE);

  const receipts = conversation.participants
    .filter((p) => p.user && !sameId(p.user, user._id) && p.joinedAt <= message.createdAt)
    .map((p) => {
      const read = p.lastReadAt && p.lastReadAt >= message.createdAt;
      const delivered = read || (p.lastDeliveredAt && p.lastDeliveredAt >= message.createdAt);
      return {
        user: publicUser(p.user),
        status: read ? 'read' : delivered ? 'delivered' : 'sent',
        readAt: read ? p.lastReadAt : null,
        deliveredAt: delivered ? p.lastDeliveredAt : null,
      };
    });

  return { message: serializeMessage(message), receipts };
}
