import * as messageService from '../services/message.service.js';
import { ok } from '../utils/respond.js';

export async function edit(req, res) {
  ok(res, { message: await messageService.editMessage(req.user, req.valid.params.id, req.valid.body.content) });
}

export async function remove(req, res) {
  ok(res, await messageService.deleteMessage(req.user, req.valid.params.id, req.valid.query.scope));
}

export async function info(req, res) {
  ok(res, await messageService.getMessageInfo(req.user, req.valid.params.id));
}
