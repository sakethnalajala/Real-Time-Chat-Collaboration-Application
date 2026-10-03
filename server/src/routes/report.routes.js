import { Router } from 'express';
import * as reports from '../controllers/report.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportLimiter } from '../middleware/rateLimiters.js';
import { createReportBody } from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.post('/', reportLimiter, validate({ body: createReportBody }), reports.create);

export default router;
