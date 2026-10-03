import multer from 'multer';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, `Files must be ${config.storage.maxFileSizeMB} MB or smaller`, 'FILE_TOO_LARGE'],
  LIMIT_FILE_COUNT: [400, `You can attach up to ${config.storage.maxFilesPerMessage} files at a time`, 'TOO_MANY_FILES'],
  LIMIT_UNEXPECTED_FILE: [400, 'Unexpected file field', 'UNEXPECTED_FILE'],
  LIMIT_PART_COUNT: [400, 'Too many form parts', 'BAD_FORM'],
  LIMIT_FIELD_VALUE: [400, 'A form field is too long', 'BAD_FORM'],
};

function normalise(err, req) {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    const [status, message, code] = MULTER_MESSAGES[err.code] || [400, err.message, 'UPLOAD_ERROR'];
    // Avatars have a smaller limit than attachments.
    if (err.code === 'LIMIT_FILE_SIZE' && (err.field === 'avatar' || err.field === 'image')) {
      return new AppError(413, `Images must be ${config.storage.maxAvatarSizeMB} MB or smaller`, code);
    }
    return new AppError(status, message, code);
  }

  if (err?.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return AppError.badRequest(details[0]?.message || 'Validation failed', details, 'VALIDATION_ERROR');
  }
  if (err?.name === 'CastError') return AppError.badRequest(`Invalid ${err.path || 'value'}`, undefined, 'INVALID_ID');
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return AppError.conflict(`That ${field} is already in use`, [{ path: field, message: `That ${field} is already in use` }], 'DUPLICATE');
  }
  if (err?.type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body', undefined, 'MALFORMED_JSON');
  if (err?.type === 'entity.too.large') return new AppError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  if (err?.message === 'CORS_ORIGIN_NOT_ALLOWED') return AppError.forbidden('This origin is not allowed', 'CORS_REJECTED');

  logger.error(`[http] ${req.method} ${req.originalUrl} →`, err);
  const internal = new AppError(500, 'Something went wrong on our side. Please try again.', 'INTERNAL_ERROR');
  internal.originalStack = err?.stack;
  return internal;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const error = normalise(err, req);
  if (res.headersSent) return;

  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  if (!config.isProd && error.originalStack) body.error.stack = error.originalStack;

  res.status(error.statusCode).json(body);
}

export function notFound(req, _res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}
