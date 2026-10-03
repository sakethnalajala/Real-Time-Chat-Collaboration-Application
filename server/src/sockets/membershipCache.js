import { Conversation } from '../models/index.js';

/* Short-lived membership cache so typing events (many per minute) don't hit MongoDB every time. */
const TTL_MS = 15_000;
const MAX_ENTRIES = 5000;
const cache = new Map();

export async function getMemberIds(conversationId) {
  const key = String(conversationId);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.members;

  const conversation = await Conversation.findById(key).select('participants.user').lean();
  const members = conversation ? conversation.participants.map((p) => String(p.user)) : [];
  cache.set(key, { members, expires: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return members;
}

/** Call whenever a conversation's membership changes. */
export function invalidateMembers(conversationId) {
  cache.delete(String(conversationId));
}
