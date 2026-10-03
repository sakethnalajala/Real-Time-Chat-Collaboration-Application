import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, USER_STATUS, LIMITS } from '../utils/constants.js';

const { Schema } = mongoose;

export const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

export const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    desktopNotifications: { type: Boolean, default: false },
    sound: { type: Boolean, default: true },
    messagePreviews: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-z0-9_.]+$/, 'Username may only contain letters, numbers, underscores and dots'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: mediaSchema, default: null },
    bio: { type: String, trim: true, maxlength: LIMITS.BIO_MAX_LENGTH, default: '' },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    statusReason: { type: String, trim: true, maxlength: 300, default: '' },
    statusChangedAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    settings: { type: settingsSchema, default: () => ({}) },
    tokenVersion: { type: Number, default: 0, select: false },
    passwordChangedAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ fullName: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) throw new Error('Password hash not loaded — query with .select("+password")');
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    return ret;
  },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
