import { config } from '../config/env.js';
import { Conversation, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex, isObjectId, pageParams, paginated, sameId } from '../utils/helpers.js';
import { publicUser, selfUser } from '../utils/serializers.js';
import { CONVERSATION_TYPES, ROLES, USER_STATUS } from '../utils/constants.js';
import { emitToUsers } from '../sockets/emitter.js';
import { storage } from './storage/index.js';

/** Ids of every user who shares at least one conversation with `userId`. */
export async function getContactIds(userId) {
  const ids = await Conversation.distinct('participants.user', { 'participants.user': userId });
  return ids.map(String).filter((id) => id !== String(userId));
}

/** Pushes profile changes (name, avatar, bio) to everyone who can see this user in a chat. */
async function broadcastProfile(user) {
  const contacts = await getContactIds(user._id);
  emitToUsers([...contacts, String(user._id)], 'user:updated', { user: publicUser(user) });
}

export async function searchUsers(viewerId, { q = '', page, limit } = {}) {
  const params = pageParams({ page, limit }, 50);
  const filter = { _id: { $ne: viewerId }, status: USER_STATUS.ACTIVE };
  const term = q.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ username: regex }, { fullName: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ fullName: 1 }).skip(params.skip).limit(params.limit),
    User.countDocuments(filter),
  ]);
  return paginated(users.map(publicUser), total, params);
}

export async function getProfile(viewer, idOrUsername) {
  const query = isObjectId(idOrUsername) ? { _id: idOrUsername } : { username: String(idOrUsername).toLowerCase() };
  const user = await User.findOne(query);
  const isSelf = user && sameId(user._id, viewer._id);
  const isAdmin = viewer.role === ROLES.ADMIN;

  if (!user || (user.status !== USER_STATUS.ACTIVE && !isSelf && !isAdmin)) throw AppError.notFound('User not found');

  const [direct, sharedGroups] = isSelf
    ? [null, []]
    : await Promise.all([
        Conversation.findOne({ type: CONVERSATION_TYPES.DIRECT, 'participants.user': { $all: [viewer._id, user._id] } }).select('_id'),
        Conversation.find({ type: CONVERSATION_TYPES.GROUP, 'participants.user': { $all: [viewer._id, user._id] } })
          .select('group.name group.avatar')
          .limit(20),
      ]);

  return {
    ...(isSelf || isAdmin ? selfUser(user) : publicUser(user)),
    isSelf: Boolean(isSelf),
    directConversationId: direct ? String(direct._id) : null,
    sharedGroups: sharedGroups.map((g) => ({ _id: String(g._id), name: g.group?.name, avatarUrl: g.group?.avatar?.url || null })),
  };
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.unauthorized();
  return selfUser(user);
}

export async function updateMe(userId, data) {
  const user = await User.findById(userId);
  if (!user) throw AppError.unauthorized();

  if (data.username && data.username.toLowerCase() !== user.username) {
    if (user.isDemo && config.demo.enabled) {
      throw AppError.forbidden('Demo accounts cannot change their username.', 'DEMO_RESTRICTED');
    }
    const taken = await User.exists({ username: data.username.toLowerCase(), _id: { $ne: user._id } });
    if (taken) throw AppError.conflict('This username is already taken', [{ path: 'username', message: 'This username is already taken' }]);
    user.username = data.username.toLowerCase();
  }
  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.bio !== undefined) user.bio = data.bio;
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (value !== undefined) user.settings[key] = value;
    }
  }

  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw AppError.conflict('This username is already taken', [{ path: 'username', message: 'This username is already taken' }]);
    throw err;
  }

  if (data.fullName !== undefined || data.username || data.bio !== undefined) await broadcastProfile(user);
  return selfUser(user);
}

export async function updateAvatar(userId, file) {
  if (!file) throw AppError.badRequest('Choose an image to upload');
  const user = await User.findById(userId);
  if (!user) throw AppError.unauthorized();

  const uploaded = await storage.upload(file, { folder: 'avatars', kind: 'image', variant: 'avatar' });
  const previous = user.avatar;
  user.avatar = { url: uploaded.url, publicId: uploaded.publicId, provider: uploaded.provider };
  await user.save();
  if (previous) storage.remove(previous);

  await broadcastProfile(user);
  return selfUser(user);
}

export async function removeAvatar(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.unauthorized();
  const previous = user.avatar;
  user.avatar = null;
  await user.save();
  if (previous) storage.remove(previous);
  await broadcastProfile(user);
  return selfUser(user);
}

export { broadcastProfile };
