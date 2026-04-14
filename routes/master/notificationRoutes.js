import express from 'express';
import notificationControllers from '../../controllers/master/notificationControllers.js';
import { protect, masterAdminAuth } from '../../middlewares/authMiddleware.js';

const router = express.Router();

// All notification endpoints require master admin authentication
router.use(protect, masterAdminAuth);

// GET: Fetch all notifications (with pagination, filtering, sorting)
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
