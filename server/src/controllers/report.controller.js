import * as reportService from '../services/report.service.js';
import { ok } from '../utils/respond.js';

export async function create(req, res) {
  ok(res, { report: await reportService.createReport(req.user, req.valid.body) }, 201);
}
