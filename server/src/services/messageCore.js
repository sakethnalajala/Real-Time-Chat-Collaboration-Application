import { Conversation, Message, Report } from '../models/index.js';
import { emitToUsers } from '../sockets/emitter.js';
import { presence } from '../sockets/presence.js';
import { idOf, sameId } from '../utils/helpers.js';
import { MESSAGE_POPULATE, previewFor, serializeMessage } from '../utils/serializers.js';
import { MESSAGE_TYPES, REPORT_STATUS } from '../utils/constants.js';
import { participantIds } from './access.js';
import { upsertMessageNotification } from './notification.service.js';
import { storage } from './storage/index.js';
import { logger } from '../utils/logger.js';

/**
 * The single write path for every message (user and system).
 *  1. persist the message (MongoDB is the source of truth)
 *  2. update the conversation summary, the sender's read watermark and everyone else's unread counter
 *  3. fan out `message:new` to every participant's personal room
 *  4. create notifications for recipients who are not looking at the conversation
 */
export async function createMessage({ conversation, sender = null, type = MESSAGE_TYPES.TEXT, content = '', attachments = [], replyTo = null, clientMsgId }) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: sender?._id ?? null,
    type,
    content,
    attachments,
    replyTo,
    clientMsgId,
  });

  const createdAt = message.createdAt;
  const preview = previewFor(message);
  const update = {
    $set: {
      lastMessage: {
        _id: message._id,
        sender: sender?._id ?? null,
        senderName: sender?.fullName ?? '',
        type,
        preview,
        isDeleted: false,
        createdAt,
      },
      lastMessageAt: createdAt,
    },
  };
  const options = {};

  if (sender) {
    update.$inc = { 'participants.$[other].unreadCount': 1 };
    update.$set['participants.$[self].lastReadAt'] = createdAt;
    update.$set['participants.$[self].lastDeliveredAt'] = createdAt;
    options.arrayFilters = [{ 'other.user': { $ne: sender._id } }, { 'self.user': sender._id }];
  }

  await Conversation.updateOne({ _id: conversation._id }, update, options);
  await message.populate(MESSAGE_POPULATE);

  const payload = {
    conversationId: idOf(conversation),
    message: serializeMessage(message),
    lastMessage: { ...update.$set.lastMessage, _id: idOf(message), sender: idOf(sender) },
    lastMessageAt: createdAt,
  };
  const recipients = participantIds(conversation);
  emitToUsers(recipients, 'message:new', payload);

  if (sender) {
    const others = recipients.filter((id) => !sameId(id, sender._id) && !presence.isViewing(id, conversation._id));
    Promise.all(
      others.map((recipientId) => upsertMessageNotification(recipientId, { conversation, message, sender, preview }))
    ).catch((err) => logger.warn('[messages] notification fan-out failed:', err.message));
  }

  return message;
}

/** Soft-deletes a message for everyone (sender, group admin or platform moderator). */
export async function removeMessageForEveryone(message, { by, moderated = false, conversation }) {
  if (message.isDeleted) return message;
  const attachments = message.attachments.map((a) => a.toObject?.() ?? a);

  message.isDeleted = true;
  message.content = '';
  message.attachments = [];
  message.deletedAt = new Date();
  message.deletedBy = by;
  message.moderated = moderated;
  await message.save();

  // Keep files that are evidence in an open report; otherwise free the storage.
  const underReview = await Report.exists({
    targetMessage: message._id,
    status: { $in: [REPORT_STATUS.OPEN, REPORT_STATUS.REVIEWING] },
  });
  if (!underReview && attachments.length) storage.removeMany(attachments);

  await Conversation.updateOne(
    { _id: message.conversation, 'lastMessage._id': message._id },
    { $set: { 'lastMessage.preview': 'This message was deleted', 'lastMessage.isDeleted': true, 'lastMessage.type': 'text' } }
  );

  const conv = conversation ?? (await Conversation.findById(message.conversation).select('participants'));
  await message.populate(MESSAGE_POPULATE);
  if (conv) {
    emitToUsers(participantIds(conv), 'message:deleted', {
      conversationId: idOf(message.conversation),
      messageId: idOf(message),
      scope: 'everyone',
      message: serializeMessage(message),
    });
  }
  return message;
}
