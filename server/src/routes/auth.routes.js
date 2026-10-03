import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage } from '../middleware/upload.js';
import {
  demoLoginLimiter,
  loginLimiter,
  passwordResetLimiter,
  refreshLimiter,
  registerLimiter,
  sensitiveActionLimiter,
} from '../middleware/rateLimiters.js';
import {
  changePasswordBody,
  demoLoginBody,
  forgotPasswordBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  resetTokenParams,
} from '../validators/schemas.js';

const router = Router();

router.post('/register', registerLimiter, uploadImage('avatar'), validate({ body: registerBody }), auth.register);
router.post('/login', loginLimiter, validate({ body: loginBody }), auth.login);
router.post('/demo-login', demoLoginLimiter, validate({ body: demoLoginBody }), auth.demoLogin);
router.post('/refresh', refreshLimiter, auth.refresh);
router.post('/logout', auth.logout);
router.post('/logout-all', protect, auth.logoutAll);
router.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordBody }), auth.forgotPassword);
router.get('/reset-password/:token', passwordResetLimiter, validate({ params: resetTokenParams }), auth.validateResetToken);
router.post(
  '/reset-password/:token',
  passwordResetLimiter,
  validate({ params: resetTokenParams, body: resetPasswordBody }),
  auth.resetPassword
);
router.patch('/change-password', protect, sensitiveActionLimiter, validate({ body: changePasswordBody }), auth.changePassword);
router.get('/me', protect, auth.me);

export default router;
