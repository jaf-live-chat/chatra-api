import notificationServices from '../../services/master/notificationServices.js';

const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, status, type, sortBy, sortOrder } = req.query;

    const result = await notificationServices.getNotifications({
      page,
      limit,
      status,
      type,
      sortBy,
      sortOrder,
    });

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
    const { notificationId } = req.params;

    const notification = await notificationServices.markAsRead(notificationId);

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
    const { notificationId } = req.params;

    const notification = await notificationServices.markAsUnread(notificationId);

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
    const { notificationIds } = req.body;

    const result = await notificationServices.markMultipleAsRead(notificationIds);

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
    const { notificationIds } = req.body;

    const result = await notificationServices.markMultipleAsUnread(notificationIds);

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
    const { notificationId } = req.params;

    const result = await notificationServices.deleteNotification(notificationId);

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
    const { notificationIds } = req.body;

    const result = await notificationServices.deleteMultiple(notificationIds);

    res.status(200).json({
      success: true,
      message: 'Notifications deleted successfully',
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
  deleteNotification,
  deleteMultiple,
};
