import mongoose from "mongoose";

const quickReplySchema = new mongoose.Schema(
  {
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
