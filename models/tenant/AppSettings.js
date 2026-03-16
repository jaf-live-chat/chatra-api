import mongoose from "mongoose";
import { ASSIGNMENT_STRATEGIES } from "../../constants/constants.js";

const appSettingSchema = new mongoose.Schema(
  {
    hasForm: {
      type: Boolean,
      required: true,
    },
    assignment: {
      type: String,
      required: true,
      enum: Object.values(ASSIGNMENT_STRATEGIES),
    },
  },
  {
    timestamps: true,
  }
)

export const getAppSettingsModel = (tenantConnection) => {
  if (tenantConnection.models.AppSettings) return tenantConnection.models.AppSettings;
  return tenantConnection.model('AppSetting', appSettingSchema);
}