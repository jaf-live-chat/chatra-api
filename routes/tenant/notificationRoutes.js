import { protect } from '../../middlewares/authMiddleware.js';

import express from 'express';
import notificationControllers from '../../controllers/tenant/notificationControllers.js';
import tenantAuth from '../../middlewares/tenantAuthMiddleware.js';

const router = express.Router();

// All notification endpoints require tenant authentication
router.use(protect, tenantAuth);

// GET: Fetch all notifications for the current agent (with pagination, filtering, sorting)
router.get('/', notificationControllers.getNotifications);

// GET: Get unread count for current agent
router.get('/unread/count', notificationControllers.getUnreadCount);

// PATCH: Mark single notification as read
router.patch('/:notificationId/read', notificationControllers.markAsRead);

// PATCH: Mark single notification as unread
router.patch('/:notificationId/unread', notificationControllers.markAsUnread);

// PATCH: Mark multiple notifications as read
router.patch('/read-multiple', notificationControllers.markMultipleAsRead);

// PATCH: Mark multiple notifications as unread
router.patch('/unread-multiple', notificationControllers.markMultipleAsUnread);

// PATCH: Mark all notifications as read for current agent
router.patch('/read/all', notificationControllers.markAllAsRead);

// PATCH: Mark all unread notifications as read for current agent
router.patch('/read/unread', notificationControllers.markAllUnreadAsRead);

// DELETE: Delete single notification
router.delete('/:notificationId', notificationControllers.deleteNotification);

// DELETE: Delete multiple notifications
router.delete('/', notificationControllers.deleteMultiple);

// DELETE: Delete all notifications for current agent
router.delete('/all', notificationControllers.deleteAllForAgent);

export default router;
