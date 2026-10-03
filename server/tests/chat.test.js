import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/models/index.js';
import { PNG_BYTES, STRONG_PASSWORD, createUser, startTestServer, stopTestServer } from './helpers.js';

let app;
let alice;
let bob;
let carol;
let admin;

beforeAll(async () => {
  ({ app } = await startTestServer());
  alice = await createUser(app, { fullName: 'Alice Doe' });
  bob = await createUser(app, { fullName: 'Bob Roe' });
  carol = await createUser(app, { fullName: 'Carol Poe' });
  admin = await createUser(app, { fullName: 'Ada Admin' });
  await User.updateOne({ _id: admin.user._id }, { role: 'admin' });
});

afterAll(async () => {
  await stopTestServer();
});

describe('Users', () => {
  it('searches users by name or username without leaking emails', async () => {
    const res = await request(app).get('/api/users/search?q=bob').set(alice.auth).expect(200);
    expect(res.body.data.items.map((u) => u._id)).toContain(bob.user._id);
    expect(res.body.data.items[0].email).toBeUndefined();
  });

  it('shows email only on your own profile', async () => {
    const other = await request(app).get(`/api/users/${bob.user._id}`).set(alice.auth).expect(200);
    expect(other.body.data.user.email).toBeUndefined();
    const own = await request(app).get(`/api/users/${alice.user._id}`).set(alice.auth).expect(200);
    expect(own.body.data.user.email).toBe(alice.user.email);
  });

  it('updates the profile and rejects taken usernames', async () => {
    const res = await request(app).patch('/api/users/me').set(alice.auth).send({ bio: 'Hello there', settings: { theme: 'light' } });
    expect(res.status).toBe(200);
    expect(res.body.data.user.bio).toBe('Hello there');
    expect(res.body.data.user.settings.theme).toBe('light');
    await request(app).patch('/api/users/me').set(alice.auth).send({ username: bob.user.username }).expect(409);
  });

  it('uploads an avatar after verifying the file contents', async () => {
    const ok = await request(app).patch('/api/users/me/avatar').set(alice.auth).attach('avatar', PNG_BYTES, { filename: 'me.png', contentType: 'image/png' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.avatarUrl).toMatch(/^\/uploads\/avatars\//);

    const spoofed = await request(app)
      .patch('/api/users/me/avatar')
      .set(alice.auth)
      .attach('avatar', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' });
    expect(spoofed.status).toBe(415);
  });
});

describe('Direct conversations and messages', () => {
  let conversationId;
  let firstMessageId;

  it('opens (get-or-create) a direct conversation', async () => {
    const created = await request(app).post('/api/conversations/direct').set(alice.auth).send({ userId: bob.user._id });
    expect(created.status).toBe(201);
    conversationId = created.body.data.conversation._id;

    const again = await request(app).post('/api/conversations/direct').set(bob.auth).send({ userId: alice.user._id });
    expect(again.status).toBe(200);
    expect(again.body.data.conversation._id).toBe(conversationId);
  });

  it('hides an empty direct chat from the recipient until the first message', async () => {
    const res = await request(app).get('/api/conversations').set(bob.auth).expect(200);
    expect(res.body.data.conversations.map((c) => c._id)).not.toContain(conversationId);
  });

  it('sends a message, persists it and updates unread counts', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .send({ content: 'Hi Bob 👋', clientMsgId: 'client-1' });
    expect(res.status).toBe(201);
    firstMessageId = res.body.data.message._id;
    expect(res.body.data.message.content).toBe('Hi Bob 👋');

    // Idempotent retry with the same client id
    const retry = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .send({ content: 'Hi Bob 👋', clientMsgId: 'client-1' });
    expect(retry.body.data.message._id).toBe(firstMessageId);

    const list = await request(app).get('/api/conversations').set(bob.auth).expect(200);
    const conv = list.body.data.conversations.find((c) => c._id === conversationId);
    const bobState = conv.participants.find((p) => p.user._id === bob.user._id);
    expect(bobState.unreadCount).toBe(1);
    expect(conv.lastMessage.preview).toBe('Hi Bob 👋');
  });

  it('rejects empty messages and non-members', async () => {
    await request(app).post(`/api/conversations/${conversationId}/messages`).set(alice.auth).send({ content: '   ' }).expect(400);
    await request(app).get(`/api/conversations/${conversationId}/messages`).set(carol.auth).expect(404);
    await request(app).post(`/api/conversations/${conversationId}/messages`).set(carol.auth).send({ content: 'hi' }).expect(404);
  });

  it('marks a conversation as read', async () => {
    await request(app).patch(`/api/conversations/${conversationId}/read`).set(bob.auth).expect(200);
    const res = await request(app).get(`/api/conversations/${conversationId}`).set(bob.auth).expect(200);
    const bobState = res.body.data.conversation.participants.find((p) => p.user._id === bob.user._id);
    expect(bobState.unreadCount).toBe(0);
    expect(bobState.lastReadAt).toBeTruthy();

    const info = await request(app).get(`/api/messages/${firstMessageId}/info`).set(alice.auth).expect(200);
    expect(info.body.data.receipts[0].status).toBe('read');
  });

  it('supports replies, edits and deletes with ownership rules', async () => {
    const reply = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(bob.auth)
      .send({ content: 'Hey Alice!', replyTo: firstMessageId });
    expect(reply.status).toBe(201);
    expect(reply.body.data.message.replyTo._id).toBe(firstMessageId);
    expect(reply.body.data.message.replyTo.content).toBe('Hi Bob 👋');

    await request(app).patch(`/api/messages/${firstMessageId}`).set(bob.auth).send({ content: 'hacked' }).expect(403);
    const edited = await request(app).patch(`/api/messages/${firstMessageId}`).set(alice.auth).send({ content: 'Hi Bob! (edited)' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.message.editedAt).toBeTruthy();

    await request(app).delete(`/api/messages/${firstMessageId}?scope=everyone`).set(bob.auth).expect(403);
    const removed = await request(app).delete(`/api/messages/${firstMessageId}?scope=everyone`).set(alice.auth).expect(200);
    expect(removed.body.data.message.isDeleted).toBe(true);
    expect(removed.body.data.message.content).toBe('');

    const replyId = reply.body.data.message._id;
    await request(app).delete(`/api/messages/${replyId}?scope=me`).set(alice.auth).expect(200);
    const aliceView = await request(app).get(`/api/conversations/${conversationId}/messages`).set(alice.auth).expect(200);
    expect(aliceView.body.data.messages.map((m) => m._id)).not.toContain(replyId);
    const bobView = await request(app).get(`/api/conversations/${conversationId}/messages`).set(bob.auth).expect(200);
    expect(bobView.body.data.messages.map((m) => m._id)).toContain(replyId);
  });

  it('shares images and files and rejects disguised or unsupported files', async () => {
    const image = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .field('content', 'Look at this')
      .attach('files', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' });
    expect(image.status).toBe(201);
    expect(image.body.data.message.type).toBe('image');
    expect(image.body.data.message.attachments[0].kind).toBe('image');

    const text = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .attach('files', Buffer.from('meeting notes\nline 2'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(text.status).toBe(201);
    expect(text.body.data.message.type).toBe('file');
    expect(text.body.data.message.attachments[0].name).toBe('notes.txt');

    const disguised = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .attach('files', Buffer.from('MZ\x90\x00not really a pdf'), { filename: 'invoice.pdf', contentType: 'application/pdf' });
    expect(disguised.status).toBe(415);

    const exe = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(alice.auth)
      .attach('files', Buffer.from('binary'), { filename: 'tool.exe', contentType: 'application/x-msdownload' });
    expect(exe.status).toBe(415);
  });

  it('paginates history with a cursor', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post(`/api/conversations/${conversationId}/messages`).set(bob.auth).send({ content: `msg ${i}` });
    }
    const page1 = await request(app).get(`/api/conversations/${conversationId}/messages?limit=3`).set(bob.auth).expect(200);
    expect(page1.body.data.messages).toHaveLength(3);
    expect(page1.body.data.hasMore).toBe(true);
    expect(page1.body.data.messages.at(-1).content).toBe('msg 4');

    const page2 = await request(app)
      .get(`/api/conversations/${conversationId}/messages?limit=3&before=${page1.body.data.nextCursor}`)
      .set(bob.auth)
      .expect(200);
    expect(page2.body.data.messages.at(-1).content).toBe('msg 1');
  });

  it('creates aggregated message notifications', async () => {
    const res = await request(app).get('/api/notifications').set(alice.auth).expect(200);
    const messageNotes = res.body.data.items.filter((n) => n.type === 'message' && n.conversation === conversationId);
    expect(messageNotes.length).toBe(1);
    expect(messageNotes[0].count).toBeGreaterThanOrEqual(5);
    await request(app).patch('/api/notifications/read-all').set(alice.auth).expect(200);
    const count = await request(app).get('/api/notifications/unread-count').set(alice.auth).expect(200);
    expect(count.body.data.unread).toBe(0);
  });
});

describe('Group conversations', () => {
  let groupId;

  it('creates a group with members and a system message', async () => {
    const res = await request(app)
      .post('/api/conversations/group')
      .set(alice.auth)
      .field('name', 'Launch Team')
      .field('description', 'Ship it')
      .field('memberIds', JSON.stringify([bob.user._id, carol.user._id]))
      .attach('image', PNG_BYTES, { filename: 'group.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    groupId = res.body.data.conversation._id;
    expect(res.body.data.conversation.group.name).toBe('Launch Team');
    expect(res.body.data.conversation.group.avatarUrl).toBeTruthy();
    expect(res.body.data.conversation.participants).toHaveLength(3);
    expect(res.body.data.conversation.lastMessage.type).toBe('system');

    const carolNotes = await request(app).get('/api/notifications').set(carol.auth).expect(200);
    expect(carolNotes.body.data.items.some((n) => n.type === 'group_added')).toBe(true);
  });

  it('requires at least one member', async () => {
    await request(app).post('/api/conversations/group').set(alice.auth).send({ name: 'Solo', memberIds: [] }).expect(400);
  });

  it('enforces group roles for membership management', async () => {
    await request(app).post(`/api/conversations/${groupId}/members`).set(carol.auth).send({ userIds: [admin.user._id] }).expect(403);
    const added = await request(app).post(`/api/conversations/${groupId}/members`).set(alice.auth).send({ userIds: [admin.user._id] });
    expect(added.status).toBe(200);
    expect(added.body.data.conversation.participants).toHaveLength(4);

    await request(app).patch(`/api/conversations/${groupId}/members/${bob.user._id}/role`).set(bob.auth).send({ role: 'admin' }).expect(403);
    await request(app).patch(`/api/conversations/${groupId}/members/${bob.user._id}/role`).set(alice.auth).send({ role: 'admin' }).expect(200);

    await request(app).delete(`/api/conversations/${groupId}/members/${carol.user._id}`).set(bob.auth).expect(200);
    await request(app).get(`/api/conversations/${groupId}/messages`).set(carol.auth).expect(404);
    await request(app).delete(`/api/conversations/${groupId}/members/${alice.user._id}`).set(bob.auth).expect(403);
  });

  it('delivers group messages to members and lets admins rename the group', async () => {
    await request(app).post(`/api/conversations/${groupId}/messages`).set(bob.auth).send({ content: 'Hello team' }).expect(201);
    const renamed = await request(app).patch(`/api/conversations/${groupId}`).set(bob.auth).send({ name: 'Launch Crew' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.conversation.group.name).toBe('Launch Crew');
    const history = await request(app).get(`/api/conversations/${groupId}/messages`).set(alice.auth).expect(200);
    expect(history.body.data.messages.some((m) => m.content === 'Hello team')).toBe(true);
    expect(history.body.data.messages.some((m) => m.type === 'system' && m.content.includes('renamed'))).toBe(true);
  });

  it('transfers ownership when the owner leaves', async () => {
    await request(app).post(`/api/conversations/${groupId}/leave`).set(alice.auth).expect(200);
    const res = await request(app).get(`/api/conversations/${groupId}`).set(bob.auth).expect(200);
    const bobState = res.body.data.conversation.participants.find((p) => p.user._id === bob.user._id);
    expect(bobState.role).toBe('owner');
  });
});

describe('Reports and administration', () => {
  let conversationId;
  let messageId;
  let reportId;

  beforeAll(async () => {
    const conv = await request(app).post('/api/conversations/direct').set(carol.auth).send({ userId: bob.user._id });
    conversationId = conv.body.data.conversation._id;
    const msg = await request(app).post(`/api/conversations/${conversationId}/messages`).set(carol.auth).send({ content: 'Buy cheap followers now!!!' });
    messageId = msg.body.data.message._id;
  });

  it('lets members report a message once', async () => {
    const res = await request(app).post('/api/reports').set(bob.auth).send({ targetType: 'message', targetId: messageId, reason: 'spam', details: 'Unsolicited ads' });
    expect(res.status).toBe(201);
    reportId = res.body.data.report._id;
    await request(app).post('/api/reports').set(bob.auth).send({ targetType: 'message', targetId: messageId, reason: 'spam' }).expect(409);
    await request(app).post('/api/reports').set(alice.auth).send({ targetType: 'message', targetId: messageId, reason: 'spam' }).expect(404);
  });

  it('shows admins statistics, users and conversation metadata only', async () => {
    const stats = await request(app).get('/api/admin/stats').set(admin.auth).expect(200);
    expect(stats.body.data.totals.users).toBeGreaterThanOrEqual(4);
    expect(stats.body.data.series.messages).toHaveLength(14);
    expect(stats.body.data.totals.openReports).toBeGreaterThanOrEqual(1);

    const users = await request(app).get('/api/admin/users?q=carol').set(admin.auth).expect(200);
    expect(users.body.data.items[0].email).toBe(carol.user.email);

    const convs = await request(app).get('/api/admin/conversations').set(admin.auth).expect(200);
    const item = convs.body.data.items.find((c) => c._id === conversationId);
    expect(item.messageCount).toBe(1);
    expect(JSON.stringify(convs.body)).not.toContain('Buy cheap followers');
  });

  it('shows the reported message with context and resolves the report', async () => {
    const detail = await request(app).get(`/api/admin/reports/${reportId}`).set(admin.auth).expect(200);
    expect(detail.body.data.report.snapshot.content).toBe('Buy cheap followers now!!!');
    expect(detail.body.data.context.messages.length).toBeGreaterThanOrEqual(1);

    const resolved = await request(app)
      .patch(`/api/admin/reports/${reportId}`)
      .set(admin.auth)
      .send({ status: 'resolved', action: 'message_removed', note: 'Spam' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.report.status).toBe('resolved');
    expect(resolved.body.data.context.currentState.isDeleted).toBe(true);

    const bobNotes = await request(app).get('/api/notifications').set(bob.auth).expect(200);
    expect(bobNotes.body.data.items.some((n) => n.type === 'report_update')).toBe(true);
  });

  it('suspends a user, blocking login and existing tokens', async () => {
    await request(app).patch(`/api/admin/users/${carol.user._id}/status`).set(admin.auth).send({ status: 'suspended', reason: 'Spam' }).expect(200);
    const login = await request(app).post('/api/auth/login').send({ email: carol.user.email, password: STRONG_PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
    await request(app).get('/api/auth/me').set(carol.auth).expect(401);

    // Bob can no longer message the suspended user
    await request(app).post(`/api/conversations/${conversationId}/messages`).set(bob.auth).send({ content: 'hello?' }).expect(403);

    await request(app).patch(`/api/admin/users/${carol.user._id}/status`).set(admin.auth).send({ status: 'active' }).expect(200);
    await request(app).post('/api/auth/login').send({ email: carol.user.email, password: STRONG_PASSWORD }).expect(200);
  });

  it('prevents admins from suspending administrators and records an audit trail', async () => {
    await request(app).patch(`/api/admin/users/${admin.user._id}/status`).set(admin.auth).send({ status: 'suspended' }).expect(400);
    const logs = await request(app).get('/api/admin/audit-logs').set(admin.auth).expect(200);
    const actions = logs.body.data.items.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['user.suspend', 'user.reactivate', 'message.remove', 'report.resolved']));
  });

  it('lets admins create a single-use password reset link without email', async () => {
    // Only admins, never for administrators or yourself.
    await request(app).post(`/api/admin/users/${carol.user._id}/reset-link`).set(bob.auth).expect(403);
    await request(app).post(`/api/admin/users/${admin.user._id}/reset-link`).set(admin.auth).expect(400);

    const res = await request(app).post(`/api/admin/users/${carol.user._id}/reset-link`).set(admin.auth);
    expect(res.status).toBe(201);
    expect(res.body.data.resetUrl).toMatch(/^http:\/\/localhost:5173\/reset-password\/[a-f\d]{64}$/);
    const token = res.body.data.resetUrl.split('/').pop();

    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'Adm1nReset!', confirmPassword: 'Adm1nReset!' }).expect(200);
    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'Again1Pass!', confirmPassword: 'Again1Pass!' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: carol.user.email, password: 'Adm1nReset!' }).expect(200);

    const logs = await request(app).get('/api/admin/audit-logs').set(admin.auth).expect(200);
    const entry = logs.body.data.items.find((l) => l.action === 'user.reset_link');
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain(token);
  });
});
