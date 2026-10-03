import * as userService from '../services/user.service.js';
import { ok } from '../utils/respond.js';

export async function search(req, res) {
  ok(res, await userService.searchUsers(req.user._id, req.valid.query));
}

export async function getProfile(req, res) {
  ok(res, { user: await userService.getProfile(req.user, req.valid.params.id) });
}

export async function getMe(req, res) {
  ok(res, { user: await userService.getMe(req.user._id) });
}

export async function updateMe(req, res) {
  ok(res, { user: await userService.updateMe(req.user._id, req.valid.body) });
}

export async function updateAvatar(req, res) {
  ok(res, { user: await userService.updateAvatar(req.user._id, req.file) });
}

export async function removeAvatar(req, res) {
  ok(res, { user: await userService.removeAvatar(req.user._id) });
}
