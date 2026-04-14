import mongoose from 'mongoose';

const NOTIFICATION_TYPES = {
  QUEUE: 'QUEUE',
  CHATS: 'CHATS',
  NEW_TENANT: 'NEW_TENANT',
  PLAN_CHANGE: 'PLAN_CHANGE',
  TENANT_STATUS: 'TENANT_STATUS',
  PAYMENT: 'PAYMENT',
  AGENT_UPDATE: 'AGENT_UPDATE',
};

const notificationSchema = new mongoose.Schema(
  {
    // Target: always for Master Admin
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    // Status: read/unread
    status: {
      type: String,
      enum: ['UNREAD', 'READ'],
      default: 'UNREAD',
    },
    // Related entity data for navigation
    relatedData: {
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null,
      },
      companyName: {
        type: String,
        default: null,
      },
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null,
      },
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null,
      },
      agentId: {
        type: String, // agent ID from tenant DB
        default: null,
      },
      agentName: {
        type: String,
        default: null,
      },
      queueId: {
        type: String,
        default: null,
      },
      conversationId: {
        type: String,
        default: null,
      },
      oldStatus: {
        type: String,
        default: null,
      },
      newStatus: {
        type: String,
        default: null,
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ type: 1 });

export const getNotificationModel = (connection) => {
  if (connection.models.MasterNotification) {
    return connection.models.MasterNotification;
  }
  return connection.model('MasterNotification', notificationSchema);
};

export { NOTIFICATION_TYPES };
