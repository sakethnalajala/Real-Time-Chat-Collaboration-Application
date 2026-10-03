import mongoose from 'mongoose';
import { MESSAGE_TYPES, LIMITS } from '../utils/constants.js';

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'file'], required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
    resourceType: { type: String, default: 'raw' },
    name: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: true }
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null for system messages
    type: { type: String, enum: Object.values(MESSAGE_TYPES), default: MESSAGE_TYPES.TEXT },
    content: { type: String, maxlength: LIMITS.MESSAGE_MAX_LENGTH, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    clientMsgId: { type: String, maxlength: 64, default: undefined },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    moderated: { type: Boolean, default: false },
    deletedFor: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true }
);

// History pagination (cursor = _id) and unread/receipt queries.
messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
// Idempotent sends: retrying the same optimistic message never creates a duplicate.
messageSchema.index(
  { sender: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: 'string' } } }
);
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

messageSchema.set('toJSON', { versionKey: false });

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
