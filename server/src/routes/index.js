import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import conversationRoutes from './conversation.routes.js';
import messageRoutes from './message.routes.js';
import notificationRoutes from './notification.routes.js';
import reportRoutes from './report.routes.js';
import userRoutes from './user.routes.js';
import { health, publicConfig } from '../controllers/system.controller.js';

const router = Router();

router.get('/health', health);
router.get('/config', publicConfig);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);

export default router;
