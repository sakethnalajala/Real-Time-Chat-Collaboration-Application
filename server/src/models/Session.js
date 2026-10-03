import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A refresh-token session. Only a SHA-256 hash of the opaque refresh token is stored.
 * Tokens rotate on every refresh; presenting an already-rotated token revokes the whole family.
 */
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    userAgent: { type: String, maxlength: 400, default: '' },
    ip: { type: String, maxlength: 100, default: '' },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['logout', 'logout_all', 'rotated', 'password_change', 'password_reset', 'admin', 'reuse_detected', null],
      default: null,
    },
  },
  { timestamps: true }
);

// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
