import mongoose from "mongoose";
import { QUEUE_STATUS } from "../../constants/constants.js";

const queueSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      unique: true,
    },
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(QUEUE_STATUS),
      default: QUEUE_STATUS.WAITING,
      required: true,
    },
    assignmentMode: {
      type: String,
      enum: ["MANUAL", "ROUND_ROBIN"],
      default: "MANUAL",
      required: true,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
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
  },
);

export const getQueueModel = (tenantConnection) => {
  if (tenantConnection.models.Queue) return tenantConnection.models.Queue;
  return tenantConnection.model("Queue", queueSchema);
};