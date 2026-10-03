import * as adminService from '../services/admin.service.js';
import * as moderation from '../services/moderation.service.js';
import * as reportService from '../services/report.service.js';
import { ok } from '../utils/respond.js';

export async function stats(_req, res) {
  ok(res, await adminService.getStats());
}

export async function listUsers(req, res) {
  ok(res, await adminService.listUsers(req.valid.query));
}

export async function getUser(req, res) {
  ok(res, await adminService.getUserDetail(req.valid.params.id));
}

export async function updateUser(req, res) {
  ok(res, { user: await adminService.updateUser(req, req.valid.params.id, req.valid.body) });
}

export async function setUserStatus(req, res) {
  const { status, reason } = req.valid.body;
  ok(res, { user: await moderation.setUserStatus(req, req.valid.params.id, status, reason) });
}

export async function forceLogout(req, res) {
  ok(res, await moderation.forceLogout(req, req.valid.params.id));
}

export async function createResetLink(req, res) {
  ok(res, await moderation.createPasswordResetLink(req, req.valid.params.id), 201);
}

export async function listConversations(req, res) {
  ok(res, await adminService.listConversations(req.valid.query));
}

export async function getConversation(req, res) {
  ok(res, await adminService.getConversationDetail(req.valid.params.id));
}

export async function listReports(req, res) {
  ok(res, await reportService.listReports(req.valid.query));
}

export async function getReport(req, res) {
  ok(res, await reportService.getReport(req.valid.params.id));
}

export async function updateReport(req, res) {
  ok(res, await reportService.updateReport(req, req.valid.params.id, req.valid.body));
}

export async function removeMessage(req, res) {
  ok(res, { message: await moderation.moderateMessage(req, req.valid.params.id, req.valid.body.reason) });
}

export async function auditLogs(req, res) {
  ok(res, await adminService.listAuditLogs(req.valid.query));
}
