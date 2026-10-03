import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { listNotificationsQuery } from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.get('/', validate({ query: listNotificationsQuery }), notifications.list);
router.get('/unread-count', notifications.count);
router.patch('/read-all', notifications.markAllRead);
router.delete('/', notifications.clearAll);
router.patch('/:id/read', validate({ params: idParam }), notifications.markRead);
router.delete('/:id', validate({ params: idParam }), notifications.remove);

export default router;
