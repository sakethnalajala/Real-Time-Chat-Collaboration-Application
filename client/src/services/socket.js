import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/env.js';
import { tokenStore } from './api.js';

/**
 * Creates the Socket.IO client. `auth` is a function so every (re)connection attempt sends the
 * current in-memory access token.
 */
export function createSocket() {
  return io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: tokenStore.get() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 20_000,
  });
}

/** Errors raised by the server's auth middleware (connection refused, refresh then retry). */
export const SOCKET_AUTH_ERRORS = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'TOKEN_REVOKED', 'NO_TOKEN', 'UNAUTHORIZED']);
