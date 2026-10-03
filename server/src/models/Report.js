import mongoose from 'mongoose';
import { REPORT_ACTIONS, REPORT_REASONS, REPORT_STATUS, REPORT_TARGETS } from '../utils/constants.js';

const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: Object.values(REPORT_TARGETS), required: true },
    // For message reports all three are set (message, its sender, its conversation) to give admins context.
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    targetConversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000, default: '' },
    // Evidence captured at report time, so later edits/deletions cannot erase it.
    snapshot: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.OPEN },
    resolution: {
      action: { type: String, enum: REPORT_ACTIONS, default: 'none' },
      note: { type: String, trim: true, maxlength: 1000, default: '' },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporter: 1, targetType: 1, targetUser: 1, targetMessage: 1, targetConversation: 1 });
reportSchema.index({ targetUser: 1, createdAt: -1 });
reportSchema.index({ targetMessage: 1, status: 1 });

reportSchema.set('toJSON', { versionKey: false });

export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
