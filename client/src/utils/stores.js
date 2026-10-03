import { useSyncExternalStore } from 'react';

/** Minimal external store for high-frequency realtime state (presence, typing). */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(updater) {
      const next = typeof updater === 'function' ? updater(state) : updater;
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Selector must return a stable value (primitive or a stored reference). */
export const useStore = (store, selector) => useSyncExternalStore(store.subscribe, () => selector(store.get()));

/* ------------------------------ presence ------------------------------ */

export const presenceStore = createStore({});

export const presenceActions = {
  setOnline(userId, isOnline, lastSeen) {
    presenceStore.set((state) => ({
      ...state,
      [userId]: { isOnline, lastSeen: lastSeen ?? state[userId]?.lastSeen ?? null },
    }));
  },
  setManyOnline(userIds) {
    presenceStore.set((state) => {
      const next = { ...state };
      userIds.forEach((id) => {
        next[id] = { isOnline: true, lastSeen: state[id]?.lastSeen ?? null };
      });
      return next;
    });
  },
  reset: () => presenceStore.set({}),
};

/** Live presence for a user: the realtime store wins over the API snapshot. */
export function usePresence(user) {
  const live = useStore(presenceStore, (state) => (user?._id ? state[user._id] : undefined));
  return {
    isOnline: live ? live.isOnline : Boolean(user?.isOnline),
    lastSeen: live?.lastSeen ?? user?.lastSeen ?? null,
  };
}

/* ------------------------------- typing ------------------------------- */

const TYPING_TTL_MS = 6000;
export const typingStore = createStore({});
const typingTimers = new Map();

export const typingActions = {
  set(conversationId, userId, name, isTyping) {
    const key = `${conversationId}:${userId}`;
    clearTimeout(typingTimers.get(key));
    typingTimers.delete(key);

    typingStore.set((state) => {
      const current = state[conversationId] || {};
      if (!isTyping && !current[userId]) return state;
      const nextConversation = { ...current };
      if (isTyping) nextConversation[userId] = name;
      else delete nextConversation[userId];
      return { ...state, [conversationId]: nextConversation };
    });

    if (isTyping) {
      typingTimers.set(
        key,
        setTimeout(() => typingActions.set(conversationId, userId, name, false), TYPING_TTL_MS)
      );
    }
  },
  reset: () => typingStore.set({}),
};

const EMPTY = {};
export const useTypingMap = (conversationId) => useStore(typingStore, (state) => state[conversationId] || EMPTY);

export function describeTyping(names) {
  if (!names.length) return '';
  const first = (n) => n.split(' ')[0];
  if (names.length === 1) return `${first(names[0])} is typing`;
  if (names.length === 2) return `${first(names[0])} and ${first(names[1])} are typing`;
  return `${names.length} people are typing`;
}

/* ------------------------- active conversation ------------------------ */

export const activeConversationStore = createStore(null);
