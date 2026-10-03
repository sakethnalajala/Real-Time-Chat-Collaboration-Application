import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { USER_STATUS } from '../utils/constants.js';
import { verifyAccessToken } from '../services/token.service.js';

/** Resolves the user behind an access token, enforcing token version and account status. */
export async function authenticateToken(token) {
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw AppError.unauthorized('Account not found', 'INVALID_TOKEN');
  if ((user.tokenVersion ?? 0) !== payload.tv) throw AppError.unauthorized('Your session has ended. Please sign in again.', 'TOKEN_REVOKED');
  if (user.status !== USER_STATUS.ACTIVE) throw AppError.forbidden('Your account has been suspended.', 'ACCOUNT_SUSPENDED');
  return user;
}

/** Requires `Authorization: Bearer <accessToken>`. */
export async function protect(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw AppError.unauthorized('Authentication required', 'NO_TOKEN');
  req.user = await authenticateToken(token);
  next();
}

/** Role-based authorization. Use after `protect`. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden('You do not have permission to access this resource', 'FORBIDDEN_ROLE');
    }
    next();
  };
