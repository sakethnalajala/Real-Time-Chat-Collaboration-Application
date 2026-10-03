import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../utils/constants.js';
import { idParam } from '../validators/common.js';
import {
  adminConversationsQuery,
  adminRemoveMessageBody,
  adminReportsQuery,
  adminUpdateReportBody,
  adminUpdateUserBody,
  adminUserStatusBody,
  adminUsersQuery,
  paginationQuery,
} from '../validators/schemas.js';

const router = Router();

// Every admin endpoint requires a valid session AND the admin role.
router.use(protect, authorize(ROLES.ADMIN));

router.get('/stats', admin.stats);

router.get('/users', validate({ query: adminUsersQuery }), admin.listUsers);
router.get('/users/:id', validate({ params: idParam }), admin.getUser);
router.patch('/users/:id', validate({ params: idParam, body: adminUpdateUserBody }), admin.updateUser);
router.patch('/users/:id/status', validate({ params: idParam, body: adminUserStatusBody }), admin.setUserStatus);
router.post('/users/:id/force-logout', validate({ params: idParam }), admin.forceLogout);
router.post('/users/:id/reset-link', validate({ params: idParam }), admin.createResetLink);

router.get('/conversations', validate({ query: adminConversationsQuery }), admin.listConversations);
router.get('/conversations/:id', validate({ params: idParam }), admin.getConversation);

router.get('/reports', validate({ query: adminReportsQuery }), admin.listReports);
router.get('/reports/:id', validate({ params: idParam }), admin.getReport);
router.patch('/reports/:id', validate({ params: idParam, body: adminUpdateReportBody }), admin.updateReport);

router.delete('/messages/:id', validate({ params: idParam, body: adminRemoveMessageBody }), admin.removeMessage);

router.get('/audit-logs', validate({ query: paginationQuery }), admin.auditLogs);

export default router;
