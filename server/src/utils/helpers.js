import crypto from 'node:crypto';
import mongoose from 'mongoose';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const idOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

export const sameId = (a, b) => Boolean(a && b) && idOf(a) === idOf(b);

export const isObjectId = (value) => mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(String(value));

export const uniqueIds = (ids) => Array.from(new Set(ids.map((id) => idOf(id)).filter(Boolean)));

export const truncate = (text, max = 120) => {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

export const pageParams = ({ page = 1, limit = 20 } = {}, maxLimit = 100) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), maxLimit);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

export const paginated = (items, total, { page, limit }) => ({
  items,
  pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1), hasMore: page * limit < total },
});

export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
