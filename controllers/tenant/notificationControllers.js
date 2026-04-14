import notificationServices from '../../services/tenant/notificationServices.js';
import { resolveTenantDatabaseName } from '../../utils/tenantContext.js';

const resolveAgentId = (req) => String(req.agent?._id || '').trim();

const getNotifications = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);
    const { page, limit, status, type, sortBy, sortOrder } = req.query;

    const result = await notificationServices.getNotifications(
      databaseName,
      agentId,
      {
        page,
        limit,
        status,
        type,
        sortBy,
        sortOrder,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const { notificationId } = req.params;

    const notification = await notificationServices.markAsRead(
      databaseName,
      notificationId
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markAsUnread = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const { notificationId } = req.params;

    const notification = await notificationServices.markAsUnread(
      databaseName,
      notificationId
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as unread',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markMultipleAsRead = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);
    const { notificationIds } = req.body;

    const result = await notificationServices.markMultipleAsRead(
      databaseName,
      agentId,
      notificationIds
    );

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const markMultipleAsUnread = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);
    const { notificationIds } = req.body;

    const result = await notificationServices.markMultipleAsUnread(
      databaseName,
      agentId,
      notificationIds
    );

    res.status(200).json({
      success: true,
      message: 'Notifications marked as unread',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const { notificationId } = req.params;

    const result = await notificationServices.deleteNotification(
      databaseName,
      notificationId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMultiple = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);
    const { notificationIds } = req.body;

    const result = await notificationServices.deleteMultiple(
      databaseName,
      agentId,
      notificationIds
    );

    res.status(200).json({
      success: true,
      message: 'Notifications deleted successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);

    const result = await notificationServices.getUnreadCount(
      databaseName,
      agentId
    );

    res.status(200).json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);

    const result = await notificationServices.markAllAsRead(
      databaseName,
      agentId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const markAllUnreadAsRead = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);

    const result = await notificationServices.markAllUnreadAsRead(
      databaseName,
      agentId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAllForAgent = async (req, res, next) => {
  try {
    const databaseName = resolveTenantDatabaseName(req, {
      errorMessage: 'Unable to resolve tenant for notifications.',
    });
    const agentId = resolveAgentId(req);

    const result = await notificationServices.deleteAllForAgent(
      databaseName,
      agentId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  markAsRead,
  markAsUnread,
  markMultipleAsRead,
  markMultipleAsUnread,
  markAllAsRead,
  markAllUnreadAsRead,
  getUnreadCount,
  deleteNotification,
  deleteMultiple,
  deleteAllForAgent,
};
