import mongoose from "mongoose";

const chatSettingSchema = new mongoose.Schema(
  {
    widgetColor: {
      type: String,
      required: true,
    },
    welcomeMessage: {
      type: String,
      required: true,
    },
    offlineMessage: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  }
)

export const getChatSettingsModel = (tenantConnection) => {
  if (tenantConnection.models.ChatSettings) return tenantConnection.models.ChatSettings;
  return tenantConnection.model('ChatSetting', chatSettingSchema);
}