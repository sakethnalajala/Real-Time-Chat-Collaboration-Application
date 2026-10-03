import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { Conversation, Message, Notification, User, directKeyFor } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { CONVERSATION_TYPES, MEMBER_ROLES, MESSAGE_TYPES, ROLES } from '../utils/constants.js';
import { previewFor } from '../utils/serializers.js';

const strongRandomPassword = () => `Demo-${crypto.randomBytes(9).toString('base64url')}9a`;

/**
 * Creates (or repairs) the four demo accounts from configuration.
 * Passwords come from DEMO_USER_PASSWORD / DEMO_ADMIN_PASSWORD; if unset, a strong random password
 * is generated (one-click demo login on the sign-in page does not need it).
 * Returns the accounts keyed by `user1 | user2 | user3 | admin`.
 */
export async function ensureDemoAccounts({ log = true, resetProfiles = false } = {}) {
  const result = {};
  let created = 0;

  for (const account of config.demo.accounts) {
    let user = await User.findOne({ email: account.email }).select('+password');

    if (!user) {
      // Free the username if a real user already owns it.
      const usernameTaken = await User.exists({ username: account.username });
      const username = usernameTaken ? `${account.username}_demo` : account.username;
      const password = account.password || strongRandomPassword();
      user = await User.create({
        fullName: account.fullName,
        username,
        email: account.email,
        password,
        bio: account.bio,
        role: account.role,
        isDemo: true,
      });
      created += 1;
      if (log) logger.info(`[demo] Created ${account.label} → ${account.email}${account.password ? '' : ' (random password; use one-click demo login)'}`);
    } else {
      let dirty = false;
      if (user.role !== account.role) {
        user.role = account.role;
        dirty = true;
      }
      if (!user.isDemo) {
        user.isDemo = true;
        dirty = true;
      }
      // Keep the password in sync with the environment so credentials stay configurable.
      if (account.password && !(await user.comparePassword(account.password))) {
        user.password = account.password;
        dirty = true;
      }
      // `npm run seed:reset` restores demo profiles that visitors may have changed.
      if (resetProfiles) {
        user.fullName = account.fullName;
        user.bio = account.bio;
        user.avatar = null;
        user.status = 'active';
        user.statusReason = '';
        user.settings = {};
        dirty = true;
      }
      if (dirty) await user.save();
    }
    result[account.key] = user;
  }

  return { accounts: result, created };
}

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

/**
 * Inserts messages with historical timestamps (ids are generated in chronological order so
 * cursor pagination stays consistent) and recomputes the conversation summary + member state.
 */
async function insertHistory(conversation, entries, readState) {
  const docs = [];
  let previous = null;
  for (const entry of entries) {
    const createdAt = minutesAgo(entry.ago);
    const doc = new Message({
      conversation: conversation._id,
      sender: entry.from?._id ?? null,
      type: entry.from ? MESSAGE_TYPES.TEXT : MESSAGE_TYPES.SYSTEM,
      content: entry.text,
      replyTo: entry.replyToPrevious ? previous?._id : null,
      createdAt,
      updatedAt: createdAt,
    });
    docs.push(doc.toObject());
    previous = doc;
  }
  await Message.collection.insertMany(docs);

  const last = docs.at(-1);
  const sender = entries.at(-1).from;
  conversation.lastMessage = {
    _id: last._id,
    sender: sender?._id ?? null,
    senderName: sender?.fullName ?? '',
    type: last.type,
    preview: previewFor(last),
    isDeleted: false,
    createdAt: last.createdAt,
  };
  conversation.lastMessageAt = last.createdAt;

  for (const participant of conversation.participants) {
    const readUntil = readState[String(participant.user)] ?? last.createdAt;
    participant.lastReadAt = readUntil;
    participant.lastDeliveredAt = last.createdAt;
    participant.unreadCount = docs.filter(
      (d) => d.sender && String(d.sender) !== String(participant.user) && d.createdAt > readUntil
    ).length;
  }
  await conversation.save();
}

/** Realistic starter conversations between the demo users (only when none exist yet). */
export async function seedSampleConversations(accounts, { reset = false } = {}) {
  const { user1: aarav, user2: maya, user3: liam } = accounts;
  const demoIds = [aarav._id, maya._id, liam._id];

  const existing = await Conversation.find({ 'participants.user': { $in: demoIds } }).select('_id');
  if (existing.length && !reset) return false;

  if (existing.length) {
    const ids = existing.map((c) => c._id);
    await Promise.all([
      Message.deleteMany({ conversation: { $in: ids } }),
      Notification.deleteMany({ conversation: { $in: ids } }),
      Conversation.deleteMany({ _id: { $in: ids } }),
    ]);
  }

  const direct = (a, b, createdAgo) =>
    Conversation.create({
      type: CONVERSATION_TYPES.DIRECT,
      directKey: directKeyFor(a._id, b._id),
      createdBy: a._id,
      participants: [
        { user: a._id, joinedAt: minutesAgo(createdAgo) },
        { user: b._id, joinedAt: minutesAgo(createdAgo) },
      ],
    });

  // Aarav ↔ Maya: everything read.
  const am = await direct(maya, aarav, 600);
  await insertHistory(
    am,
    [
      { from: maya, ago: 190, text: 'Hey Aarav! Did you get a chance to look at the new onboarding flow? 👀' },
      { from: aarav, ago: 182, text: 'Just did — the transitions feel super smooth. Left a few notes in the design doc.' },
      { from: maya, ago: 176, text: "Amazing, thank you! I'll polish the empty states next." },
      { from: aarav, ago: 171, text: 'Also, the dark mode contrast on the sidebar is 🔥', replyToPrevious: false },
      { from: maya, ago: 168, text: 'Haha that was the whole goal 😄 Ship it Friday?', replyToPrevious: true },
      { from: aarav, ago: 160, text: "Friday works. Let's do a quick review Thursday afternoon." },
    ],
    {}
  );

  // Aarav ↔ Liam: Aarav has one unread message.
  const al = await direct(liam, aarav, 400);
  const liamLast = minutesAgo(12);
  await insertHistory(
    al,
    [
      { from: liam, ago: 64, text: 'Socket server is deployed to staging 🚀' },
      { from: aarav, ago: 58, text: 'Nice! Are typing indicators working on your side?' },
      { from: liam, ago: 12, text: 'Yep — and read receipts too ✅ Try it from two browsers.' },
    ],
    { [String(aarav._id)]: new Date(liamLast.getTime() - 1000) }
  );

  // Group: Product Launch
  const created = minutesAgo(1440);
  const group = await Conversation.create({
    type: CONVERSATION_TYPES.GROUP,
    createdBy: aarav._id,
    group: { name: 'Product Launch 🚀', description: 'Coordinating the v1 launch — design, frontend and backend in one place.' },
    participants: [
      { user: aarav._id, role: MEMBER_ROLES.OWNER, joinedAt: created },
      { user: maya._id, role: MEMBER_ROLES.MEMBER, joinedAt: created },
      { user: liam._id, role: MEMBER_ROLES.ADMIN, joinedAt: created },
    ],
  });
  const mayaRead = minutesAgo(35);
  await insertHistory(
    group,
    [
      { from: null, ago: 1440, text: 'Aarav Sharma created the group "Product Launch 🚀"' },
      { from: aarav, ago: 1430, text: "Welcome team! Let's use this group for launch coordination." },
      { from: maya, ago: 300, text: 'Landing page copy is ready for review ✍️' },
      { from: liam, ago: 290, text: 'API is green across the board 💚', replyToPrevious: false },
      { from: aarav, ago: 40, text: 'Great work everyone. Final checklist review tomorrow at 10:00.' },
      { from: liam, ago: 20, text: "I'll bring the load-test numbers 📈" },
    ],
    { [String(maya._id)]: mayaRead }
  );

  logger.info('[demo] Seeded sample conversations for the demo users');
  return true;
}

/** Called on server start when DEMO_MODE=true. */
export async function bootstrapDemo() {
  if (!config.demo.enabled) return;
  try {
    const { accounts } = await ensureDemoAccounts();
    if (config.demo.seedSampleData && accounts.user1 && accounts.user2 && accounts.user3) {
      await seedSampleConversations(accounts);
    }
    const admin = accounts.admin;
    if (admin && admin.role !== ROLES.ADMIN) logger.warn('[demo] Demo admin does not have the admin role');
  } catch (err) {
    logger.error('[demo] Failed to prepare demo accounts:', err.message);
  }
}
