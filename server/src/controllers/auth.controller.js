import * as authService from '../services/auth.service.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../services/token.service.js';
import { selfUser } from '../utils/serializers.js';
import { noContent, ok } from '../utils/respond.js';

const sendSession = (res, { user, accessToken, refreshToken }, status = 200) => {
  setRefreshCookie(res, refreshToken);
  ok(res, { user, accessToken }, status);
};

export async function register(req, res) {
  sendSession(res, await authService.register(req.valid.body, req.file, req), 201);
}

export async function login(req, res) {
  sendSession(res, await authService.login(req.valid.body, req));
}

export async function demoLogin(req, res) {
  sendSession(res, await authService.demoLogin(req.valid.body.account, req));
}

export async function refresh(req, res) {
  try {
    sendSession(res, await authService.refresh(readRefreshCookie(req), req));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  noContent(res);
}

export async function logoutAll(req, res) {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  noContent(res);
}

export async function forgotPassword(req, res) {
  ok(res, await authService.forgotPassword(req.valid.body.email));
}

export async function validateResetToken(req, res) {
  ok(res, await authService.validateResetToken(req.valid.params.token));
}

export async function resetPassword(req, res) {
  ok(res, await authService.resetPassword(req.valid.params.token, req.valid.body.password));
}

export async function changePassword(req, res) {
  ok(res, await authService.changePassword(req.user._id, readRefreshCookie(req), req.valid.body));
}

export async function me(req, res) {
  ok(res, { user: selfUser(req.user) });
}
