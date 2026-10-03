import { uniqueIds } from '../utils/helpers.js';

/**
 * Thin wrapper around the Socket.IO server so services can emit events
 * without importing the socket bootstrap (and so tests can run without sockets).
 * Every authenticated socket joins `user:<id>`; admins also join `admins`.
 */
let io = null;

export const ADMIN_ROOM = 'admins';
export const userRoom = (userId) => `user:${userId}`;

export const setIO = (instance) => {
  io = instance;
};

export const getIO = () => io;

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(userRoom(String(userId))).emit(event, payload);
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  const rooms = uniqueIds(userIds || []).map(userRoom);
  if (rooms.length) io.to(rooms).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  if (!io) return;
  io.to(ADMIN_ROOM).emit(event, payload);
}

/** Forcibly disconnects every socket of a user (suspension, forced logout, password change). */
export function disconnectUser(userId, event, payload) {
  if (!io || !userId) return;
  if (event) emitToUser(userId, event, payload);
  // Give the event a moment to flush before closing the transport.
  setTimeout(() => io?.in(userRoom(String(userId))).disconnectSockets(true), 250).unref?.();
}
