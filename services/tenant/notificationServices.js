import { getTenantConnection } from '../../config/tenantDB.js';
import { getNotificationModel, NOTIFICATION_TYPES } from '../../models/tenant/Notifications.js';
import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const normalizeText = (value, fallback = '') => String(value ?? fallback).trim();

const parsePagination = (page, limit) => {
  const pageNumber = Math.max(1, Number.parseInt(String(page || DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limitNumber = Math.max(1, Math.min(100, Number.parseInt(String(limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber,
  };
};

const createNotification = async (databaseName, payload) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    const { agentId, type, title, message, relatedData = {} } = payload || {};

    if (!agentId || !type || !title || !message) {
      throw new BadRequestError('agentId, type, title, and message are required');
    }

    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new BadRequestError(`Invalid notification type: ${type}`);
    }

    const { Notification } = getTenantConnection(databaseName);

    const notification = new Notification({
      agentId,
      type,
      title,
      message,
      relatedData,
      status: 'UNREAD',
    });

    await notification.save();

    logger.info(`[NOTIFICATION] Tenant notification created: agentId=${agentId}, type=${type}, databaseName=${databaseName}, id=${notification._id}`);

    return notification.toObject();
  } catch (error) {
    logger.error(`Error creating tenant notification: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to create notification: ${error.message}`);
  }
};

const getNotifications = async (databaseName, agentId, query = {}) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    if (!agentId) {
      throw new BadRequestError('agentId is required');
    }

    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      status,
      type,
      sortBy = 'createdAt',
      sortOrder = '-1',
    } = query;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(page, limit);

    const { Notification } = getTenantConnection(databaseName);

    // Build filter
    const filter = { agentId };
    if (status && ['READ', 'UNREAD'].includes(status)) {
      filter.status = status;
    }
    if (type && Object.values(NOTIFICATION_TYPES).includes(type)) {
      filter.type = type;
    }

    // Build sort
    const sort = {};
    const sortOrderNum = sortOrder === '1' ? 1 : -1;
    sort[sortBy] = sortOrderNum;

    // Execute queries in parallel
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    const unreadCount = await Notification.countDocuments({ agentId, status: 'UNREAD' });

    return {
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      unreadCount,
    };
  } catch (error) {
    logger.error(`Error fetching tenant notifications: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to fetch notifications: ${error.message}`);
  }
};

const markAsRead = async (databaseName, notificationId) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    if (!notificationId) {
      throw new BadRequestError('notificationId is required');
    }

    const { Notification } = getTenantConnection(databaseName);

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: 'READ' },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`[NOTIFICATION] Tenant notification marked as read: id=${notificationId}`);

    return notification.toObject();
  } catch (error) {
    logger.error(`Error marking notification as read: ${error.message}`);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError(`Failed to mark notification as read: ${error.message}`);
  }
};

const markMultipleAsRead = async (databaseName, agentId, notificationIds) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    if (!agentId) {
      throw new BadRequestError('agentId is required');
    }

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError('notificationIds must be a non-empty array');
    }

    const { Notification } = getTenantConnection(databaseName);

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, agentId },
      { status: 'READ' }
    );

    logger.info(`[NOTIFICATION] Marked ${result.modifiedCount} tenant notifications as read for agent=${agentId}`);

    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  } catch (error) {
    logger.error(`Error marking multiple notifications as read: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to mark notifications as read: ${error.message}`);
  }
};

const deleteNotification = async (databaseName, notificationId) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    if (!notificationId) {
      throw new BadRequestError('notificationId is required');
    }

    const { Notification } = getTenantConnection(databaseName);

    const result = await Notification.findByIdAndDelete(notificationId);

    if (!result) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`[NOTIFICATION] Tenant notification deleted: id=${notificationId}`);

    return {
      message: 'Notification deleted successfully',
      id: notificationId,
    };
  } catch (error) {
    logger.error(`Error deleting notification: ${error.message}`);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError(`Failed to delete notification: ${error.message}`);
  }
};

const deleteMultiple = async (databaseName, agentId, notificationIds) => {
  try {
    if (!databaseName) {
      throw new BadRequestError('databaseName is required');
    }

    if (!agentId) {
      throw new BadRequestError('agentId is required');
    }

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError('notificationIds must be a non-empty array');
    }

    const { Notification } = getTenantConnection(databaseName);

    const result = await Notification.deleteMany({ _id: { $in: notificationIds }, agentId });

    logger.info(`[NOTIFICATION] Deleted ${result.deletedCount} tenant notifications for agent=${agentId}`);

    return {
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    logger.error(`Error deleting multiple notifications: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to delete notifications: ${error.message}`);
  }
};

export default {
  createNotification,
  getNotifications,
  markAsRead,
  markMultipleAsRead,
  deleteNotification,
  deleteMultiple,
};
