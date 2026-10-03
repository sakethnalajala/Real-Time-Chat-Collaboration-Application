import * as conversationService from '../services/conversation.service.js';
import * as messageService from '../services/message.service.js';
import { ok } from '../utils/respond.js';

export async function list(req, res) {
  ok(res, { conversations: await conversationService.listConversations(req.user._id, req.valid.query) });
}

export async function getOne(req, res) {
  ok(res, { conversation: await conversationService.getConversation(req.user._id, req.valid.params.id) });
}

export async function openDirect(req, res) {
  const { conversation, created } = await conversationService.openDirectConversation(req.user, req.valid.body.userId);
  ok(res, { conversation, created }, created ? 201 : 200);
}

export async function createGroup(req, res) {
  ok(res, { conversation: await conversationService.createGroup(req.user, req.valid.body, req.file) }, 201);
}

export async function updateGroup(req, res) {
  ok(res, { conversation: await conversationService.updateGroup(req.user, req.valid.params.id, req.valid.body, req.file) });
}

export async function remove(req, res) {
  ok(res, await conversationService.deleteConversation(req.user, req.valid.params.id));
}

export async function markRead(req, res) {
  ok(res, await conversationService.markRead(req.user._id, req.valid.params.id));
}

export async function addMembers(req, res) {
  ok(res, { conversation: await conversationService.addMembers(req.user, req.valid.params.id, req.valid.body.userIds) });
}

export async function removeMember(req, res) {
  const { id, userId } = req.valid.params;
  ok(res, await conversationService.removeMember(req.user, id, userId));
}

export async function changeRole(req, res) {
  const { id, userId } = req.valid.params;
  ok(res, { conversation: await conversationService.changeMemberRole(req.user, id, userId, req.valid.body.role) });
}

export async function leave(req, res) {
  ok(res, await conversationService.leaveGroup(req.user, req.valid.params.id));
}

export async function listMessages(req, res) {
  ok(res, await messageService.listMessages(req.user._id, req.valid.params.id, req.valid.query));
}

export async function sendMessage(req, res) {
  ok(res, { message: await messageService.sendMessage(req.user, req.valid.params.id, req.valid.body, req.files || []) }, 201);
}
