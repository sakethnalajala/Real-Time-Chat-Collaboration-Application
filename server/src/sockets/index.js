import { Server } from 'socket.io';
import { isAllowedOrigin } from '../config/cors.js';
import { authenticateToken } from '../middleware/auth.js';
import { User } from '../models/index.js';
import { ROLES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { getContactIds } from '../services/user.service.js';
import { markAllDelivered } from '../services/conversation.service.js';
import { ADMIN_ROOM, emitToAdmins, emitToUsers, setIO, userRoom } from './emitter.js';
import { presence } from './presence.js';
import { registerChatHandlers } from './handlers/chat.js';

async function authenticateSocket(socket, next) {
  try {
    const header = socket.handshake.headers?.authorization || '';
    const token = socket.handshake.auth?.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) throw Object.assign(new Error('Authentication required'), { code: 'NO_TOKEN' });
    socket.data.user = await authenticateToken(token);
    next();
  } catch (err) {
    const error = new Error(err.code || 'UNAUTHORIZED');
    error.data = { code: err.code || 'UNAUTHORIZED', message: err.message };
    next(error);
  }
}

async function onConnection(socket) {
  const user = socket.data.user;
  const userId = String(user._id);

  socket.join(userRoom(userId));
  if (user.role === ROLES.ADMIN) socket.join(ADMIN_ROOM);

  const cameOnline = presence.add(userId, socket.id);
  registerChatHandlers(socket);

  socket.on('disconnect', () => {
    const lastSocket = presence.remove(userId, socket.id);
    if (!lastSocket) return;
    presence.scheduleOffline(userId, async () => {
      try {
        const lastSeen = new Date();
        await User.updateOne({ _id: userId }, { $set: { lastSeen } });
        emitToUsers(await getContactIds(userId), 'presence:offline', { userId, lastSeen });
        emitToAdmins('admin:presence', { online: presence.onlineCount() });
      } catch (err) {
        logger.warn('[socket] offline broadcast failed:', err.message);
      }
    });
  });

  try {
    const contacts = await getContactIds(userId);
    socket.emit('presence:snapshot', { online: contacts.filter((id) => presence.isOnline(id)) });
    if (cameOnline) {
      emitToUsers(contacts, 'presence:online', { userId });
      emitToAdmins('admin:presence', { online: presence.onlineCount() });
    }
    // Everything sent while this user was offline is now delivered.
    await markAllDelivered(userId);
  } catch (err) {
    logger.warn('[socket] connection bootstrap failed:', err.message);
  }
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error('Origin not allowed'))),
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 100 * 1024,
  });

  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    onConnection(socket).catch((err) => logger.error('[socket] connection handler crashed:', err));
  });

  setIO(io);
  return io;
}
