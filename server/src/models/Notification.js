import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

const { Schema } = mongoose;

/**
 * Message notifications are aggregated: one unread notification per (recipient, conversation)
 * whose `count` grows, instead of one document per message.
 */
const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    message: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    report: { type: Schema.Types.ObjectId, ref: 'Report', default: null },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '', maxlength: 300 },
    count: { type: Number, default: 1, min: 1 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, updatedAt: -1 });
notificationSchema.index({ recipient: 1, updatedAt: -1 });
// At most one unread aggregated message notification per conversation per recipient.
notificationSchema.index(
  { recipient: 1, conversation: 1 },
  { unique: true, partialFilterExpression: { type: 'message', isRead: false } }
);
notificationSchema.index({ recipient: 1, conversation: 1, isRead: 1 });
// Old notifications expire after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

notificationSchema.set('toJSON', { versionKey: false });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
