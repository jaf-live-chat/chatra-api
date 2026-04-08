import mongoose from "mongoose";

const quickMessageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    response: {
      type: String,
      required: [true, "Response is required"],
      trim: true,
    }

  },
  {
    timestamps: true
  },
);

export const getQuickMessagesModel = (tenantConnection) => {
  if (tenantConnection.models.QuickMessages) return tenantConnection.models.QuickMessages;
  return tenantConnection.model("QuickMessages", quickMessageSchema);
};
