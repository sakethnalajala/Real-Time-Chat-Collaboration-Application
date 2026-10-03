import { Router } from 'express';
import * as messages from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { deleteMessageQuery, editMessageBody } from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.patch('/:id', validate({ params: idParam, body: editMessageBody }), messages.edit);
router.delete('/:id', validate({ params: idParam, query: deleteMessageQuery }), messages.remove);
router.get('/:id/info', validate({ params: idParam }), messages.info);

export default router;
