import mongoose from 'mongoose';

const NOTIFICATION_TYPES = {
  QUEUE: 'QUEUE',
  CHATS: 'CHATS',
  AGENT_UPDATE: 'AGENT_UPDATE',
};

const notificationSchema = new mongoose.Schema(
  {
    // Target agent
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agents',
      required: [true, 'Agent ID is required'],
    },
    // Notification type
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
      queueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Queue',
        default: null,
      },
      queueEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversations',
        default: null,
      },
      visitorName: {
        type: String,
        default: null,
      },
      visitorEmail: {
        type: String,
        default: null,
      },
      triggeringAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null,
      },
      triggeringAgentName: {
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
notificationSchema.index({ agentId: 1, createdAt: -1 });
notificationSchema.index({ agentId: 1, status: 1 });
notificationSchema.index({ agentId: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

export const getNotificationModel = (connection) => {
  if (connection.models.Notification) {
    return connection.models.Notification;
  }
  return connection.model('Notification', notificationSchema);
};

export { NOTIFICATION_TYPES };
