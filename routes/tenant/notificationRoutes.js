import { protect } from '../../middlewares/authMiddleware.js';

import express from 'express';
import notificationControllers from '../../controllers/tenant/notificationControllers.js';
import tenantAuth from '../../middlewares/tenantAuthMiddleware.js';

const router = express.Router();

// All notification endpoints require tenant authentication
router.use(protect, tenantAuth);

// GET: Fetch all notifications for the current agent (with pagination, filtering, sorting)
router.get('/', notificationControllers.getNotifications);

// PATCH: Mark single notification as read
router.patch('/:notificationId/read', notificationControllers.markAsRead);

// PATCH: Mark multiple notifications as read
router.patch('/read-multiple', notificationControllers.markMultipleAsRead);

// DELETE: Delete single notification
router.delete('/:notificationId', notificationControllers.deleteNotification);

// DELETE: Delete multiple notifications
router.delete('/', notificationControllers.deleteMultiple);

export default router;
