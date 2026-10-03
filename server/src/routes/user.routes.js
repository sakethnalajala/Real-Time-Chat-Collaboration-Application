import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { searchUsersQuery, updateMeBody, userParams } from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.get('/search', validate({ query: searchUsersQuery }), users.search);
router.get('/me', users.getMe);
router.patch('/me', validate({ body: updateMeBody }), users.updateMe);
router.patch('/me/avatar', uploadLimiter, uploadImage('avatar'), users.updateAvatar);
router.delete('/me/avatar', users.removeAvatar);
router.get('/:id', validate({ params: userParams }), users.getProfile);

export default router;
