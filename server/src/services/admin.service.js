import { AuditLog, Conversation, Message, Report, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex, idOf, isObjectId, pageParams, paginated, sameId } from '../utils/helpers.js';
import { PUBLIC_USER_FIELDS, adminUser, publicUser } from '../utils/serializers.js';
import { CONVERSATION_TYPES, REPORT_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { presence } from '../sockets/presence.js';
import { audit } from './audit.service.js';
import { assertDemoGuard } from './moderation.service.js';
import { serializeReport } from './report.service.js';
import { countActiveSessions } from './token.service.js';
import { broadcastProfile } from './user.service.js';
import { storage } from './storage/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const utcMidnight = (offsetDays = 0) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays));
};

const dailySeries = async (Model, match, since, days) => {
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { date: day, count: map.get(day) || 0 };
  });
};

export async function getStats() {
  const today = utcMidnight();
  const since14 = utcMidnight(13);
  const since7 = new Date(Date.now() - 7 * DAY_MS);

  const [
    totalUsers,
    newUsers7d,
    suspendedUsers,
    totalConversations,
    groupCount,
    activeConversations7d,
    totalMessages,
    messagesToday,
    openReports,
    messageSeries,
    signupSeries,
    typeBreakdown,
    recentUsers,
    recentReports,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: since7 } }),
    User.countDocuments({ status: USER_STATUS.SUSPENDED }),
    Conversation.countDocuments(),
    Conversation.countDocuments({ type: CONVERSATION_TYPES.GROUP }),
    Conversation.countDocuments({ lastMessageAt: { $gte: since7 } }),
    Message.countDocuments({ type: { $ne: 'system' } }),
    Message.countDocuments({ type: { $ne: 'system' }, createdAt: { $gte: today } }),
    Report.countDocuments({ status: { $in: [REPORT_STATUS.OPEN, REPORT_STATUS.REVIEWING] } }),
    dailySeries(Message, { type: { $ne: 'system' } }, since14, 14),
    dailySeries(User, {}, since14, 14),
    Message.aggregate([{ $match: { type: { $ne: 'system' } } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    User.find().sort({ createdAt: -1 }).limit(6),
    Report.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'reporter', select: PUBLIC_USER_FIELDS })
      .populate({ path: 'targetUser', select: PUBLIC_USER_FIELDS }),
  ]);

  return {
    totals: {
      users: totalUsers,
      newUsers7d,
      suspendedUsers,
      onlineNow: presence.onlineCount(),
      activeSockets: presence.socketCount(),
      conversations: totalConversations,
      groups: groupCount,
      directConversations: totalConversations - groupCount,
      activeConversations7d,
      messages: totalMessages,
      messagesToday,
      openReports,
    },
    series: { messages: messageSeries, signups: signupSeries },
    messageTypes: Object.fromEntries(typeBreakdown.map((t) => [t._id, t.count])),
    recentUsers: recentUsers.map(adminUser),
    recentReports: recentReports.map(serializeReport),
    storage: { driver: storage.driverName, enabled: storage.enabled },
    generatedAt: new Date(),
  };
}

export async function listUsers({ q = '', role, status, page, limit } = {}) {
  const params = pageParams({ page, limit }, 100);
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  const term = q.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ fullName: regex }, { username: regex }, { email: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(params.skip).limit(params.limit),
    User.countDocuments(filter),
  ]);
  return paginated(users.map(adminUser), total, params);
}

export async function getUserDetail(userId) {
  if (!isObjectId(userId)) throw AppError.notFound('User not found');
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');

  const [conversations, groups, messages, reportsFiled, reportsAgainst, activeSessions, recentReports, recentActions] = await Promise.all([
    Conversation.countDocuments({ 'participants.user': user._id }),
    Conversation.countDocuments({ 'participants.user': user._id, type: CONVERSATION_TYPES.GROUP }),
    Message.countDocuments({ sender: user._id }),
    Report.countDocuments({ reporter: user._id }),
    Report.countDocuments({ targetUser: user._id }),
    countActiveSessions(user._id),
    Report.find({ targetUser: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'reporter', select: PUBLIC_USER_FIELDS }),
    AuditLog.find({ targetType: 'user', targetId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: 'actor', select: 'fullName username' }),
  ]);

  return {
    user: adminUser(user),
    stats: { conversations, groups, directConversations: conversations - groups, messages, reportsFiled, reportsAgainst, activeSessions },
    recentReports: recentReports.map(serializeReport),
    auditTrail: recentActions.map((a) => ({
      _id: idOf(a),
      action: a.action,
      actor: a.actor ? { _id: idOf(a.actor), fullName: a.actor.fullName, username: a.actor.username } : null,
      meta: a.meta,
      createdAt: a.createdAt,
    })),
  };
}

/** Moderation edit of another user's public profile (e.g. offensive name or avatar). */
export async function updateUser(req, userId, { fullName, username, bio, removeAvatar }) {
  if (!isObjectId(userId)) throw AppError.notFound('User not found');
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  if (user.role === ROLES.ADMIN && !sameId(user._id, req.user._id)) {
    throw AppError.forbidden("You can't edit another administrator's profile");
  }
  assertDemoGuard(req.user, user);

  const changes = {};
  if (username && username !== user.username) {
    if (await User.exists({ username, _id: { $ne: user._id } })) {
      throw AppError.conflict('This username is already taken', [{ path: 'username', message: 'This username is already taken' }]);
    }
    changes.username = [user.username, username];
    user.username = username;
  }
  if (fullName !== undefined && fullName !== user.fullName) {
    changes.fullName = [user.fullName, fullName];
    user.fullName = fullName;
  }
  if (bio !== undefined && bio !== user.bio) {
    changes.bio = true;
    user.bio = bio;
  }
  let removed = null;
  if (removeAvatar && user.avatar) {
    removed = user.avatar;
    user.avatar = null;
    changes.avatar = 'removed';
  }

  if (!Object.keys(changes).length) return adminUser(user);
  await user.save();
  if (removed) storage.remove(removed);
  await broadcastProfile(user);
  await audit(req, 'user.update_profile', 'user', user._id, changes);
  return adminUser(user);
}

/** Conversation monitoring: metadata only (members, counts, activity) — never message content. */
export async function listConversations({ q = '', type, page, limit } = {}) {
  const params = pageParams({ page, limit }, 100);
  const filter = {};
  if (type) filter.type = type;

  const term = q.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    const users = await User.find({ $or: [{ username: regex }, { fullName: regex }] }).select('_id').limit(200);
    filter.$or = [{ 'group.name': regex }, { 'participants.user': { $in: users.map((u) => u._id) } }];
  }

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .populate({ path: 'participants.user', select: PUBLIC_USER_FIELDS })
      .populate({ path: 'createdBy', select: 'fullName username' }),
    Conversation.countDocuments(filter),
  ]);

  const ids = conversations.map((c) => c._id);
  const [messageCounts, reportCounts] = await Promise.all([
    Message.aggregate([
      { $match: { conversation: { $in: ids }, type: { $ne: 'system' } } },
      { $group: { _id: '$conversation', count: { $sum: 1 }, attachments: { $sum: { $size: '$attachments' } } } },
    ]),
    Report.aggregate([{ $match: { targetConversation: { $in: ids } } }, { $group: { _id: '$targetConversation', count: { $sum: 1 } } }]),
  ]);
  const msgMap = new Map(messageCounts.map((m) => [String(m._id), m]));
  const reportMap = new Map(reportCounts.map((r) => [String(r._id), r.count]));

  const items = conversations.map((c) => {
    const members = c.participants.filter((p) => p.user);
    return {
      _id: idOf(c),
      type: c.type,
      name: c.type === CONVERSATION_TYPES.GROUP ? c.group?.name : members.map((p) => p.user.fullName).join(' & '),
      avatarUrl: c.group?.avatar?.url || null,
      memberCount: members.length,
      members: members.slice(0, 5).map((p) => ({ ...publicUser(p.user), role: p.role })),
      createdBy: c.createdBy ? { _id: idOf(c.createdBy), fullName: c.createdBy.fullName, username: c.createdBy.username } : null,
      messageCount: msgMap.get(String(c._id))?.count || 0,
      attachmentCount: msgMap.get(String(c._id))?.attachments || 0,
      reportCount: reportMap.get(String(c._id)) || 0,
      lastActivityAt: c.lastMessageAt || c.createdAt,
      createdAt: c.createdAt,
    };
  });

  return paginated(items, total, params);
}

export async function getConversationDetail(conversationId) {
  if (!isObjectId(conversationId)) throw AppError.notFound('Conversation not found');
  const c = await Conversation.findById(conversationId)
    .populate({ path: 'participants.user', select: PUBLIC_USER_FIELDS })
    .populate({ path: 'createdBy', select: 'fullName username' });
  if (!c) throw AppError.notFound('Conversation not found');

  const since7 = new Date(Date.now() - 7 * DAY_MS);
  const [messageCount, messages7d, attachmentAgg, reports] = await Promise.all([
    Message.countDocuments({ conversation: c._id, type: { $ne: 'system' } }),
    Message.countDocuments({ conversation: c._id, type: { $ne: 'system' }, createdAt: { $gte: since7 } }),
    Message.aggregate([{ $match: { conversation: c._id } }, { $group: { _id: null, total: { $sum: { $size: '$attachments' } } } }]),
    Report.find({ targetConversation: c._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({ path: 'reporter', select: PUBLIC_USER_FIELDS })
      .populate({ path: 'targetUser', select: PUBLIC_USER_FIELDS }),
  ]);

  const members = c.participants.filter((p) => p.user);
  return {
    conversation: {
      _id: idOf(c),
      type: c.type,
      name: c.type === CONVERSATION_TYPES.GROUP ? c.group?.name : members.map((p) => p.user.fullName).join(' & '),
      description: c.group?.description || '',
      avatarUrl: c.group?.avatar?.url || null,
      createdBy: c.createdBy ? { _id: idOf(c.createdBy), fullName: c.createdBy.fullName, username: c.createdBy.username } : null,
      createdAt: c.createdAt,
      lastActivityAt: c.lastMessageAt || c.createdAt,
      members: members.map((p) => ({ ...publicUser(p.user), role: p.role, joinedAt: p.joinedAt })),
    },
    stats: { messageCount, messages7d, attachmentCount: attachmentAgg[0]?.total || 0, reportCount: reports.length },
    reports: reports.map(serializeReport),
  };
}

export async function listAuditLogs({ page, limit } = {}) {
  const params = pageParams({ page, limit }, 100);
  const [logs, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(params.skip).limit(params.limit).populate({ path: 'actor', select: 'fullName username' }),
    AuditLog.countDocuments(),
  ]);
  return paginated(
    logs.map((a) => ({
      _id: idOf(a),
      action: a.action,
      targetType: a.targetType,
      targetId: idOf(a.targetId),
      actor: a.actor ? { _id: idOf(a.actor), fullName: a.actor.fullName, username: a.actor.username } : null,
      meta: a.meta,
      createdAt: a.createdAt,
    })),
    total,
    params
  );
}

export { audit };
