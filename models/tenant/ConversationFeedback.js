import mongoose from "mongoose";

const conversationFeedbackSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      unique: true,
      index: true,
    },
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

conversationFeedbackSchema.index({ agentId: 1, createdAt: -1 });
conversationFeedbackSchema.index({ visitorId: 1, createdAt: -1 });

export const getConversationFeedbackModel = (tenantConnection) => {
  if (tenantConnection.models.ConversationFeedback) return tenantConnection.models.ConversationFeedback;
  return tenantConnection.model("ConversationFeedback", conversationFeedbackSchema);
};