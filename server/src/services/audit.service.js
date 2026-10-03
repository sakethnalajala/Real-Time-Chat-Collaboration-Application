import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Records an administrative action. Best-effort: failures are logged, never thrown. */
export async function audit(req, action, targetType, targetId, meta = {}) {
  try {
    await AuditLog.create({
      actor: req.user._id,
      action,
      targetType,
      targetId,
      meta,
      ip: String(req.ip || '').slice(0, 100),
    });
  } catch (err) {
    logger.warn('[audit] failed to record action:', err.message);
  }
}
