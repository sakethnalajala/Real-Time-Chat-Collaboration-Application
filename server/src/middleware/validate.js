import { AppError } from '../utils/AppError.js';

/**
 * Validates and normalises request input with zod schemas.
 * Parsed values are exposed on `req.valid.{params,query,body}` (unknown keys are stripped,
 * which also prevents mass-assignment of fields like `role`).
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid ??= {};
  for (const key of ['params', 'query', 'body']) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || key,
        message: issue.message,
      }));
      throw AppError.badRequest(details[0]?.message || 'Validation failed', details, 'VALIDATION_ERROR');
    }
    req.valid[key] = result.data;
  }
  next();
};
