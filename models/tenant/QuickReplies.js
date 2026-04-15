import mongoose from "mongoose";

const quickReplySchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: [true, "agentId is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    isPosted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true
  },
);

export const getQuickRepliesModel = (tenantConnection) => {
  if (tenantConnection.models.QuickReplies) return tenantConnection.models.QuickReplies;
  return tenantConnection.model("QuickReplies", quickReplySchema);
};
