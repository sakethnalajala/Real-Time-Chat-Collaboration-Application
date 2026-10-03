import { Router } from 'express';
import * as conversations from '../controllers/conversation.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadAttachments, uploadImage } from '../middleware/upload.js';
import { messageLimiter, uploadLimiter } from '../middleware/rateLimiters.js';
import { idParam } from '../validators/common.js';
import {
  addMembersBody,
  createGroupBody,
  directBody,
  listConversationsQuery,
  listMessagesQuery,
  memberParams,
  memberRoleBody,
  sendMessageBody,
  updateGroupBody,
} from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.get('/', validate({ query: listConversationsQuery }), conversations.list);
router.post('/direct', validate({ body: directBody }), conversations.openDirect);
router.post('/group', uploadLimiter, uploadImage('image'), validate({ body: createGroupBody }), conversations.createGroup);

router.get('/:id', validate({ params: idParam }), conversations.getOne);
router.patch('/:id', uploadImage('image'), validate({ params: idParam, body: updateGroupBody }), conversations.updateGroup);
router.delete('/:id', validate({ params: idParam }), conversations.remove);
router.patch('/:id/read', validate({ params: idParam }), conversations.markRead);

router.post('/:id/members', validate({ params: idParam, body: addMembersBody }), conversations.addMembers);
router.delete('/:id/members/:userId', validate({ params: memberParams }), conversations.removeMember);
router.patch('/:id/members/:userId/role', validate({ params: memberParams, body: memberRoleBody }), conversations.changeRole);
router.post('/:id/leave', validate({ params: idParam }), conversations.leave);

router.get('/:id/messages', validate({ params: idParam, query: listMessagesQuery }), conversations.listMessages);
router.post(
  '/:id/messages',
  messageLimiter,
  uploadAttachments,
  validate({ params: idParam, body: sendMessageBody }),
  conversations.sendMessage
);

export default router;
