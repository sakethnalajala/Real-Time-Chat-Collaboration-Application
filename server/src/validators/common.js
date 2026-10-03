import { z } from 'zod';

export const objectId = z
  .string({ error: 'Id is required' })
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const optionalObjectId = z.preprocess(
  (value) => (value === '' || value === null || value === 'null' ? undefined : value),
  objectId.optional()
);

export const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

export const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number');

export const username = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z0-9_.]+$/, 'Use only letters, numbers, underscores and dots');

export const fullName = z
  .string({ error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(60, 'Full name must be at most 60 characters');

export const bio = z.string().trim().max(160, 'Bio must be at most 160 characters');

/** Accepts real booleans and the strings "true"/"false" (query strings, multipart fields). */
export const booleanish = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === '') return false;
  return value;
}, z.boolean());

export const page = z.coerce.number().int().min(1).default(1);
export const limit = (max = 50, fallback = 20) => z.coerce.number().int().min(1).max(max).default(fallback);

/** Arrays sent as JSON strings, comma lists, repeated fields or real arrays. */
export const idArray = (min = 1, max = 99) =>
  z.preprocess(
    (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
          try {
            return JSON.parse(trimmed);
          } catch {
            return value;
          }
        }
        return trimmed ? trimmed.split(',').map((v) => v.trim()) : [];
      }
      return value;
    },
    z
      .array(objectId, { error: 'Provide a list of user ids' })
      .min(min, min === 1 ? 'Select at least one member' : `Select at least ${min} members`)
      .max(max, `You can select at most ${max} members`)
  );

export const idParam = z.object({ id: objectId });
