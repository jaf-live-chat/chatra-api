import { getMasterConnection } from '../../config/masterDB.js';
import { getNotificationModel, NOTIFICATION_TYPES } from '../../models/master/Notifications.js';
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

const createNotification = async (payload) => {
  try {
    const {
      type,
      title,
      message,
      relatedData = {},
    } = payload || {};

    if (!type || !title || !message) {
      throw new BadRequestError('type, title, and message are required');
    }

    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new BadRequestError(`Invalid notification type: ${type}`);
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const notification = new Notification({
      type,
      title,
      message,
      relatedData,
      status: 'UNREAD',
    });

    await notification.save();

    logger.info(`[NOTIFICATION] Master Admin notification created: type=${type}, id=${notification._id}`);

    return notification.toObject();
  } catch (error) {
    logger.error(`Error creating master notification: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to create notification: ${error.message}`);
  }
};

const getNotifications = async (query = {}) => {
  try {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      status,
      type,
      sortBy = 'createdAt',
      sortOrder = '-1',
    } = query;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(page, limit);

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    // Build filter
    const filter = {};
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

    const unreadCount = await Notification.countDocuments({ status: 'UNREAD' });

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
    logger.error(`Error fetching master notifications: ${error.message}`);
    throw new InternalServerError(`Failed to fetch notifications: ${error.message}`);
  }
};

const markAsRead = async (notificationId) => {
  try {
    if (!notificationId) {
      throw new BadRequestError('notificationId is required');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: 'READ' },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`[NOTIFICATION] Master notification marked as read: id=${notificationId}`);

    return notification.toObject();
  } catch (error) {
    logger.error(`Error marking notification as read: ${error.message}`);
    if (error instanceof (BadRequestError || NotFoundError)) {
      throw error;
    }
    throw new InternalServerError(`Failed to mark notification as read: ${error.message}`);
  }
};

const markAsUnread = async (notificationId) => {
  try {
    if (!notificationId) {
      throw new BadRequestError('notificationId is required');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: 'UNREAD' },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`[NOTIFICATION] Master notification marked as unread: id=${notificationId}`);

    return notification.toObject();
  } catch (error) {
    logger.error(`Error marking notification as unread: ${error.message}`);
    if (error instanceof (BadRequestError || NotFoundError)) {
      throw error;
    }
    throw new InternalServerError(`Failed to mark notification as unread: ${error.message}`);
  }
};

const markMultipleAsRead = async (notificationIds) => {
  try {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError('notificationIds must be a non-empty array');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { status: 'READ' }
    );

    logger.info(`[NOTIFICATION] Marked ${result.modifiedCount} master notifications as read`);

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

const markMultipleAsUnread = async (notificationIds) => {
  try {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError('notificationIds must be a non-empty array');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { status: 'UNREAD' }
    );

    logger.info(`[NOTIFICATION] Marked ${result.modifiedCount} master notifications as unread`);

    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  } catch (error) {
    logger.error(`Error marking multiple notifications as unread: ${error.message}`);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Failed to mark notifications as unread: ${error.message}`);
  }
};

const deleteNotification = async (notificationId) => {
  try {
    if (!notificationId) {
      throw new BadRequestError('notificationId is required');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const result = await Notification.findByIdAndDelete(notificationId);

    if (!result) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`[NOTIFICATION] Master notification deleted: id=${notificationId}`);

    return {
      message: 'Notification deleted successfully',
      id: notificationId,
    };
  } catch (error) {
    logger.error(`Error deleting notification: ${error.message}`);
    if (error instanceof (BadRequestError || NotFoundError)) {
      throw error;
    }
    throw new InternalServerError(`Failed to delete notification: ${error.message}`);
  }
};

const deleteMultiple = async (notificationIds) => {
  try {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError('notificationIds must be a non-empty array');
    }

    const { connection } = getMasterConnection();
    const Notification = getNotificationModel(connection);

    const result = await Notification.deleteMany({ _id: { $in: notificationIds } });

    logger.info(`[NOTIFICATION] Deleted ${result.deletedCount} master notifications`);

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
  markAsUnread,
  markMultipleAsRead,
  markMultipleAsUnread,
  deleteNotification,
  deleteMultiple,
};
