import mongoose from "mongoose";
import { CONVERSATION_STATUS } from "../../constants/constants.js";

const conversationSchema = new mongoose.Schema(
  {
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visitor',
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },
    visitorToken: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
    },
    userAgent: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(CONVERSATION_STATUS),
      default: CONVERSATION_STATUS.WAITING,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    locationCity: {
      type: String,
      trim: true,
      default: null,
    },
    locationCountry: {
      type: String,
      trim: true,
      default: null,
    },
    locationSource: {
      type: String,
      trim: true,
      default: null,
    },
    locationConsent: {
      type: Boolean,
      default: false,
    },
    locationResolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedByRole: {
      type: String,
      trim: true,
      default: null,
    },
    closedById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

export const getConversationModel = (tenantConnection) => {
  if (tenantConnection.models.Conversation) return tenantConnection.models.Conversation;
  return tenantConnection.model('Conversation', conversationSchema);
}