import { api, refreshAccessToken, unwrap } from './api.js';

const toFormData = (fields, files = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  for (const [key, value] of Object.entries(files)) {
    if (!value) continue;
    (Array.isArray(value) ? value : [value]).forEach((file) => form.append(key, file));
  }
  return form;
};

export const configService = {
  get: () => unwrap(api.get('/config')),
};

export const authService = {
  register: ({ avatar, ...fields }) => unwrap(api.post('/auth/register', toFormData(fields, { avatar }))),
  login: (credentials) => unwrap(api.post('/auth/login', credentials)),
  demoLogin: (account) => unwrap(api.post('/auth/demo-login', { account })),
  refresh: () => refreshAccessToken(),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  me: () => unwrap(api.get('/auth/me')),
  forgotPassword: (email) => unwrap(api.post('/auth/forgot-password', { email })),
  validateResetToken: (token) => unwrap(api.get(`/auth/reset-password/${token}`)),
  resetPassword: (token, body) => unwrap(api.post(`/auth/reset-password/${token}`, body)),
  changePassword: (body) => unwrap(api.patch('/auth/change-password', body)),
};

export const userService = {
  search: (params) => unwrap(api.get('/users/search', { params })),
  getProfile: (id) => unwrap(api.get(`/users/${id}`)),
  updateMe: (body) => unwrap(api.patch('/users/me', body)),
  updateAvatar: (file) => unwrap(api.patch('/users/me/avatar', toFormData({}, { avatar: file }))),
  removeAvatar: () => unwrap(api.delete('/users/me/avatar')),
};

export const conversationService = {
  list: (q) => unwrap(api.get('/conversations', { params: q ? { q } : undefined })),
  get: (id) => unwrap(api.get(`/conversations/${id}`)),
  openDirect: (userId) => unwrap(api.post('/conversations/direct', { userId })),
  createGroup: ({ name, description, memberIds, image }) =>
    unwrap(api.post('/conversations/group', toFormData({ name, description, memberIds }, { image }))),
  updateGroup: (id, { image, ...fields }) => unwrap(api.patch(`/conversations/${id}`, toFormData(fields, { image }))),
  remove: (id) => unwrap(api.delete(`/conversations/${id}`)),
  markRead: (id) => unwrap(api.patch(`/conversations/${id}/read`)),
  addMembers: (id, userIds) => unwrap(api.post(`/conversations/${id}/members`, { userIds })),
  removeMember: (id, userId) => unwrap(api.delete(`/conversations/${id}/members/${userId}`)),
  changeRole: (id, userId, role) => unwrap(api.patch(`/conversations/${id}/members/${userId}/role`, { role })),
  leave: (id) => unwrap(api.post(`/conversations/${id}/leave`)),
  messages: (id, params) => unwrap(api.get(`/conversations/${id}/messages`, { params })),
  sendMessage: (id, { content, replyTo, clientMsgId, files = [] }, onProgress) => {
    const body = files.length
      ? toFormData({ content, replyTo, clientMsgId }, { files })
      : { content, replyTo: replyTo || undefined, clientMsgId };
    return unwrap(
      api.post(`/conversations/${id}/messages`, body, {
        onUploadProgress: files.length && onProgress ? (e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100)) : undefined,
      })
    );
  },
};

export const messageService = {
  edit: (id, content) => unwrap(api.patch(`/messages/${id}`, { content })),
  remove: (id, scope) => unwrap(api.delete(`/messages/${id}`, { params: { scope } })),
  info: (id) => unwrap(api.get(`/messages/${id}/info`)),
};

export const notificationService = {
  list: (params) => unwrap(api.get('/notifications', { params })),
  unreadCount: () => unwrap(api.get('/notifications/unread-count')),
  markRead: (id) => unwrap(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(api.patch('/notifications/read-all')),
  remove: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => unwrap(api.delete('/notifications')),
};

export const reportService = {
  create: (body) => unwrap(api.post('/reports', body)),
};

export const adminService = {
  stats: () => unwrap(api.get('/admin/stats')),
  users: (params) => unwrap(api.get('/admin/users', { params })),
  user: (id) => unwrap(api.get(`/admin/users/${id}`)),
  updateUser: (id, body) => unwrap(api.patch(`/admin/users/${id}`, body)),
  setStatus: (id, status, reason) => unwrap(api.patch(`/admin/users/${id}/status`, { status, reason })),
  forceLogout: (id) => unwrap(api.post(`/admin/users/${id}/force-logout`)),
  createResetLink: (id) => unwrap(api.post(`/admin/users/${id}/reset-link`)),
  conversations: (params) => unwrap(api.get('/admin/conversations', { params })),
  conversation: (id) => unwrap(api.get(`/admin/conversations/${id}`)),
  reports: (params) => unwrap(api.get('/admin/reports', { params })),
  report: (id) => unwrap(api.get(`/admin/reports/${id}`)),
  updateReport: (id, body) => unwrap(api.patch(`/admin/reports/${id}`, body)),
  removeMessage: (id, reason) => unwrap(api.delete(`/admin/messages/${id}`, { data: { reason } })),
  auditLogs: (params) => unwrap(api.get('/admin/audit-logs', { params })),
};
