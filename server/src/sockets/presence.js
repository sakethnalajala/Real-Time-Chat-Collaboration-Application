/**
 * In-memory presence registry for a single Node process.
 * userId -> Set<socketId>, plus which conversation each socket is currently viewing.
 *
 * Horizontal scaling note: with more than one instance, move this to Redis and add
 * @socket.io/redis-adapter so rooms span instances.
 */
const socketsByUser = new Map();
const focusBySocket = new Map(); // socketId -> { userId, conversationId }
const offlineTimers = new Map();

export const presence = {
  /** Registers a socket. Returns true when the user just came online. */
  add(userId, socketId) {
    const id = String(userId);
    const pending = offlineTimers.get(id);
    if (pending) {
      clearTimeout(pending);
      offlineTimers.delete(id);
    }
    let set = socketsByUser.get(id);
    const wasOnline = Boolean(set?.size) || Boolean(pending);
    if (!set) {
      set = new Set();
      socketsByUser.set(id, set);
    }
    set.add(socketId);
    return !wasOnline;
  },

  /** Unregisters a socket. Returns true when that was the user's last socket. */
  remove(userId, socketId) {
    const id = String(userId);
    focusBySocket.delete(socketId);
    const set = socketsByUser.get(id);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      socketsByUser.delete(id);
      return true;
    }
    return false;
  },

  /** Waits a short grace period (page reloads, flaky networks) before declaring a user offline. */
  scheduleOffline(userId, callback, delayMs = 4000) {
    const id = String(userId);
    if (offlineTimers.has(id)) clearTimeout(offlineTimers.get(id));
    const timer = setTimeout(() => {
      offlineTimers.delete(id);
      if (!socketsByUser.get(id)?.size) callback();
    }, delayMs);
    timer.unref?.();
    offlineTimers.set(id, timer);
  },

  isOnline(userId) {
    const id = String(userId);
    return Boolean(socketsByUser.get(id)?.size) || offlineTimers.has(id);
  },

  onlineUserIds() {
    return Array.from(new Set([...socketsByUser.keys(), ...offlineTimers.keys()]));
  },

  onlineCount() {
    return this.onlineUserIds().length;
  },

  socketCount() {
    let count = 0;
    for (const set of socketsByUser.values()) count += set.size;
    return count;
  },

  setFocus(socketId, userId, conversationId) {
    if (conversationId) focusBySocket.set(socketId, { userId: String(userId), conversationId: String(conversationId) });
    else focusBySocket.delete(socketId);
  },

  /** True when any of the user's sockets currently has the conversation open and visible. */
  isViewing(userId, conversationId) {
    const set = socketsByUser.get(String(userId));
    if (!set) return false;
    for (const socketId of set) {
      if (focusBySocket.get(socketId)?.conversationId === String(conversationId)) return true;
    }
    return false;
  },

  reset() {
    socketsByUser.clear();
    focusBySocket.clear();
    for (const timer of offlineTimers.values()) clearTimeout(timer);
    offlineTimers.clear();
  },
};
