import { Conversation } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { isObjectId, idOf } from '../utils/helpers.js';
import { PARTICIPANT_POPULATE } from '../utils/serializers.js';
import { CONVERSATION_TYPES, MEMBER_ROLES } from '../utils/constants.js';

/**
 * Loads a conversation only if `userId` is a participant.
 * Non-members get 404 (not 403) so conversation ids cannot be probed.
 */
export async function getConversationForMember(conversationId, userId, { populate = false } = {}) {
  if (!isObjectId(conversationId)) throw AppError.notFound('Conversation not found');
  const query = Conversation.findOne({ _id: conversationId, 'participants.user': userId });
  if (populate) query.populate(PARTICIPANT_POPULATE);
  const conversation = await query;
  if (!conversation) throw AppError.notFound('Conversation not found');
  return conversation;
}

export const participantIds = (conversation) => conversation.participants.map((p) => idOf(p.user));

export const roleOf = (conversation, userId) => conversation.getParticipant(userId)?.role ?? null;

export function requireGroup(conversation) {
  if (conversation.type !== CONVERSATION_TYPES.GROUP) {
    throw AppError.badRequest('This action is only available for group conversations');
  }
}

export function requireGroupAdmin(conversation, userId) {
  requireGroup(conversation);
  const role = roleOf(conversation, userId);
  if (role !== MEMBER_ROLES.OWNER && role !== MEMBER_ROLES.ADMIN) {
    throw AppError.forbidden('Only group admins can do that');
  }
  return role;
}

export function requireGroupOwner(conversation, userId) {
  requireGroup(conversation);
  if (roleOf(conversation, userId) !== MEMBER_ROLES.OWNER) {
    throw AppError.forbidden('Only the group owner can do that');
  }
}
