import mongoose from 'mongoose';
import { mediaSchema } from './User.js';
import { CONVERSATION_TYPES, MEMBER_ROLES, LIMITS } from '../utils/constants.js';

const { Schema } = mongoose;

/**
 * Per-member state lives on the conversation:
 *  - lastDeliveredAt / lastReadAt are "watermarks": every message created at or before the
 *    timestamp has been delivered to / read by that member. Message ticks are derived from them,
 *    which scales to groups without storing a receipt per message per member.
 *  - unreadCount is a denormalised counter, incremented on send and reset on read.
 *  - clearedAt hides older history for that member only ("delete chat" in a direct conversation).
 */
const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.values(MEMBER_ROLES), default: MEMBER_ROLES.MEMBER },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: null },
    lastDeliveredAt: { type: Date, default: null },
    unreadCount: { type: Number, default: 0, min: 0 },
    clearedAt: { type: Date, default: null },
  },
  { _id: false }
);

const groupSchema = new Schema(
  {
    name: { type: String, trim: true, minlength: 1, maxlength: LIMITS.GROUP_NAME_MAX_LENGTH },
    description: { type: String, trim: true, maxlength: LIMITS.GROUP_DESCRIPTION_MAX_LENGTH, default: '' },
    avatar: { type: mediaSchema, default: null },
  },
  { _id: false }
);

const lastMessageSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, default: '' },
    type: { type: String, default: 'text' },
    preview: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    type: { type: String, enum: Object.values(CONVERSATION_TYPES), required: true },
    participants: { type: [participantSchema], default: [] },
    directKey: { type: String, default: undefined },
    group: { type: groupSchema, default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: lastMessageSchema, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });
conversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } });
conversationSchema.index({ type: 1, createdAt: -1 });
conversationSchema.index({ lastMessageAt: -1 });

conversationSchema.pre('validate', function validateShape() {
  if (this.type === CONVERSATION_TYPES.DIRECT) {
    if (this.participants.length !== 2) this.invalidate('participants', 'A direct conversation needs exactly 2 participants');
    if (!this.directKey) this.invalidate('directKey', 'directKey is required for direct conversations');
  }
  if (this.type === CONVERSATION_TYPES.GROUP) {
    if (!this.group?.name) this.invalidate('group.name', 'Group name is required');
    if (this.participants.length > LIMITS.GROUP_MAX_MEMBERS)
      this.invalidate('participants', `A group can have at most ${LIMITS.GROUP_MAX_MEMBERS} members`);
  }
});

conversationSchema.methods.getParticipant = function getParticipant(userId) {
  return this.participants.find((p) => String(p.user?._id ?? p.user) === String(userId)) || null;
};

conversationSchema.set('toJSON', { versionKey: false });

export const directKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
