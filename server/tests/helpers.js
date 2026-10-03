import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as connectClient } from 'socket.io-client';
import { connectDatabase } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { initSocket } from '../src/sockets/index.js';
import { getIO } from '../src/sockets/emitter.js';
import { presence } from '../src/sockets/presence.js';

let mongod;
let server;

export async function startTestServer() {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  await mongoose.connection.syncIndexes();
  const app = createApp();
  server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { app, server, baseUrl };
}

export async function stopTestServer() {
  getIO()?.close();
  await new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()));
  presence.reset();
  await mongoose.disconnect();
  await mongod?.stop();
}

export const STRONG_PASSWORD = 'Sup3rSecret!';

let counter = 0;
export function userInput(overrides = {}) {
  counter += 1;
  const handle = overrides.username || `user${Date.now().toString(36)}${counter}`;
  return {
    fullName: overrides.fullName || `Test User ${counter}`,
    username: handle,
    email: overrides.email || `${handle}@example.com`,
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
    ...overrides,
  };
}

/** Registers a user with its own cookie jar. Returns { agent, user, token, auth }. */
export async function createUser(app, overrides = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send(userInput(overrides));
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.data.accessToken;
  return { agent, user: res.body.data.user, token, auth: { Authorization: `Bearer ${token}` } };
}

export function connectSocket(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

export function waitFor(socket, event, predicate = () => true, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    function listener(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    }
    socket.on(event, listener);
  });
}

export const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

// 1×1 transparent PNG
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
