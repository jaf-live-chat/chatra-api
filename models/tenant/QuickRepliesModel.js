import mongoose from "mongoose";

const quickReplySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    isPosted: {
      type: Boolean,
      default: true,
    },
    response: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true
  },
);

export const getTenantModel = (tenantConnection) => {
  if (tenantConnection.models.Tenant) return tenantConnection.models.Tenant;
  return tenantConnection.model("Tenant", tenantSchema);
};
