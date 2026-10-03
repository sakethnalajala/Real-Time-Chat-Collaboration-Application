import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectSocket, createUser, emitAck, startTestServer, stopTestServer, waitFor } from './helpers.js';

let app;
let baseUrl;
let alice;
let bob;
let conversationId;
const sockets = [];

beforeAll(async () => {
  ({ app, baseUrl } = await startTestServer());
  alice = await createUser(app, { fullName: 'Alice Socket' });
  bob = await createUser(app, { fullName: 'Bob Socket' });
  const conv = await request(app).post('/api/conversations/direct').set(alice.auth).send({ userId: bob.user._id });
  conversationId = conv.body.data.conversation._id;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await stopTestServer();
});

describe('Socket.IO real-time layer', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connectSocket(baseUrl, 'garbage')).rejects.toThrow(/INVALID_TOKEN|UNAUTHORIZED/);
  });

  it('broadcasts presence to contacts', async () => {
    const aliceSocket = await connectSocket(baseUrl, alice.token);
    sockets.push(aliceSocket);
    const online = waitFor(aliceSocket, 'presence:online', (p) => p.userId === bob.user._id);
    const bobSocket = await connectSocket(baseUrl, bob.token);
    sockets.push(bobSocket);
    await expect(online).resolves.toMatchObject({ userId: bob.user._id });
  });

  it('delivers new messages, delivery and read receipts in real time', async () => {
    const [aliceSocket, bobSocket] = sockets;

    const incoming = waitFor(bobSocket, 'message:new', (p) => p.conversationId === conversationId);
    const sent = await request(app).post(`/api/conversations/${conversationId}/messages`).set(alice.auth).send({ content: 'Realtime hello' }).expect(201);
    const payload = await incoming;
    expect(payload.message.content).toBe('Realtime hello');
    expect(payload.message.sender._id).toBe(alice.user._id);

    const delivered = waitFor(aliceSocket, 'receipt:update', (p) => p.type === 'delivered' && p.userId === bob.user._id);
    const ack = await emitAck(bobSocket, 'message:delivered', { conversationId, messageId: sent.body.data.message._id });
    expect(ack.ok).toBe(true);
    await expect(delivered).resolves.toMatchObject({ conversationId });

    const read = waitFor(aliceSocket, 'receipt:update', (p) => p.type === 'read' && p.userId === bob.user._id);
    const readAck = await emitAck(bobSocket, 'conversation:read', { conversationId });
    expect(readAck.ok).toBe(true);
    await expect(read).resolves.toMatchObject({ conversationId });
  });

  it('relays typing indicators to other members only', async () => {
    const [aliceSocket, bobSocket] = sockets;
    const typing = waitFor(bobSocket, 'typing:update', (p) => p.isTyping && p.userId === alice.user._id);
    await emitAck(aliceSocket, 'typing:start', { conversationId });
    await expect(typing).resolves.toMatchObject({ conversationId, name: 'Alice Socket' });

    const stopped = waitFor(bobSocket, 'typing:update', (p) => !p.isTyping);
    await emitAck(aliceSocket, 'typing:stop', { conversationId });
    await expect(stopped).resolves.toMatchObject({ isTyping: false });
  });

  it('rejects typing in conversations the user is not part of', async () => {
    const outsider = await createUser(app, { fullName: 'Eve Outsider' });
    const eveSocket = await connectSocket(baseUrl, outsider.token);
    sockets.push(eveSocket);
    const ack = await emitAck(eveSocket, 'typing:start', { conversationId });
    expect(ack.ok).toBe(false);
  });

  it('pushes edits, deletions and notifications', async () => {
    const [aliceSocket, bobSocket] = sockets;
    // Bob is not viewing the conversation, so a notification is created.
    await emitAck(bobSocket, 'conversation:focus', { conversationId: null });
    const notification = waitFor(bobSocket, 'notification:new', (p) => p.notification.type === 'message');
    const sent = await request(app).post(`/api/conversations/${conversationId}/messages`).set(alice.auth).send({ content: 'Ping' }).expect(201);
    await expect(notification).resolves.toBeTruthy();

    const updated = waitFor(bobSocket, 'message:updated');
    await request(app).patch(`/api/messages/${sent.body.data.message._id}`).set(alice.auth).send({ content: 'Pong' }).expect(200);
    await expect(updated).resolves.toMatchObject({ message: { content: 'Pong' } });

    const deleted = waitFor(bobSocket, 'message:deleted');
    await request(app).delete(`/api/messages/${sent.body.data.message._id}?scope=everyone`).set(alice.auth).expect(200);
    await expect(deleted).resolves.toMatchObject({ scope: 'everyone' });

    // While Bob views the conversation, no new notification is created.
    await emitAck(bobSocket, 'conversation:focus', { conversationId });
    let notified = false;
    const listener = () => {
      notified = true;
    };
    bobSocket.on('notification:new', listener);
    const msg = waitFor(bobSocket, 'message:new');
    await request(app).post(`/api/conversations/${conversationId}/messages`).set(alice.auth).send({ content: 'You are here' }).expect(201);
    await msg;
    await new Promise((r) => setTimeout(r, 300));
    bobSocket.off('notification:new', listener);
    expect(notified).toBe(false);
    expect(aliceSocket.connected).toBe(true);
  });

  it('marks a user offline with a last-seen timestamp after disconnecting', async () => {
    const [aliceSocket, bobSocket] = sockets;
    const offline = waitFor(aliceSocket, 'presence:offline', (p) => p.userId === bob.user._id, 8000);
    bobSocket.close();
    const payload = await offline;
    expect(new Date(payload.lastSeen).getTime()).toBeGreaterThan(Date.now() - 15_000);
  }, 15_000);
});
