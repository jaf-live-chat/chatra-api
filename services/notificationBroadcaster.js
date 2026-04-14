import { broadcastLiveChatEvent } from './liveChatRealtime.js';
import { logger } from '../utils/logger.js';

/**
 * Broadcast notification to Master Admin users via WebSocket
 * @param {Object} notification - Full notification object from DB
 */
const broadcastMasterAdminNotification = (notification) => {
  if (!notification || !notification._id) {
    logger.warn('[NOTIFICATION] Invalid notification object for master admin broadcast');
    return;
  }

  try {
    // Broadcast to master admin room (all master admins connected)
    broadcastLiveChatEvent(
      { databaseName: 'master' }, // Special marker for master admin room
      'NOTIFICATION_CREATED',
      {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          status: notification.status,
          relatedData: notification.relatedData,
          createdAt: notification.createdAt,
        },
      }
    );

    logger.info(`[NOTIFICATION] Broadcasted master admin notification: type=${notification.type}, id=${notification._id}`);
  } catch (error) {
    logger.error(`Error broadcasting master admin notification: ${error.message}`);
  }
};

/**
 * Broadcast notification to staff (Admin/Support Agent) users via WebSocket
 * @param {string} databaseName - Tenant database name
 * @param {string} agentId - Target agent ID
 * @param {Object} notification - Full notification object from DB
 */
const broadcastTenantNotification = (databaseName, agentId, notification) => {
  if (!databaseName || !agentId || !notification || !notification._id) {
    logger.warn('[NOTIFICATION] Invalid params for tenant notification broadcast', {
      databaseName,
      agentId,
      notificationId: notification?._id,
    });
    return;
  }

  try {
    // Broadcast to the specific agent's room
    broadcastLiveChatEvent(
      { databaseName, agentId },
      'NOTIFICATION_CREATED',
      {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          status: notification.status,
          relatedData: notification.relatedData,
          createdAt: notification.createdAt,
        },
      }
    );

    logger.info(`[NOTIFICATION] Broadcasted tenant notification to agent=${agentId}, type=${notification.type}, id=${notification._id}`);
  } catch (error) {
    logger.error(`Error broadcasting tenant notification: ${error.message}`);
  }
};

/**
 * Broadcast notification to multiple agents in a tenant
 * @param {string} databaseName - Tenant database name
 * @param {string[]} agentIds - Target agent IDs
 * @param {Object} notification - Full notification object from DB
 */
const broadcastTenantNotificationToMultipleAgents = (databaseName, agentIds, notification) => {
  if (!databaseName || !Array.isArray(agentIds) || !notification || !notification._id) {
    logger.warn('[NOTIFICATION] Invalid params for multi-agent notification broadcast');
    return;
  }

  try {
    agentIds.forEach((agentId) => {
      broadcastTenantNotification(databaseName, agentId, notification);
    });

    logger.info(`[NOTIFICATION] Broadcasted notification to ${agentIds.length} agents in ${databaseName}`);
  } catch (error) {
    logger.error(`Error broadcasting to multiple agents: ${error.message}`);
  }
};

export {
  broadcastMasterAdminNotification,
  broadcastTenantNotification,
  broadcastTenantNotificationToMultipleAgents,
};
