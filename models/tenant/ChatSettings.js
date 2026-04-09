import mongoose from "mongoose";

const chatSettingSchema = new mongoose.Schema(
  {
    assignmentMode: {
      type: String,
      enum: ["MANUAL", "ROUND_ROBIN"],
      default: "ROUND_ROBIN",
    },
    roundRobinPointer: {
      type: Number,
      default: 0,
      min: 0,
    },
  }
)

export const getChatSettingsModel = (tenantConnection) => {
  if (tenantConnection.models.ChatSetting) return tenantConnection.models.ChatSetting;
  return tenantConnection.model('ChatSetting', chatSettingSchema);
}