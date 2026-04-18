import mongoose from "mongoose";

const widgetSettingsSchema = new mongoose.Schema(
  {
    widgetLogo: {
      type: String,
      trim: true,
      default: "",
    },
    widgetTitle: {
      type: String,
      required: [true, "widgetTitle is required"],
      trim: true,
      default: "Support",
    },
    welcomeMessage: {
      type: String,
      required: [true, "welcomeMessage is required"],
      trim: true,
      default: "Hi there. Welcome to our support team. How can I help you today?",
    },
    accentColor: {
      type: String,
      trim: true,
      default: "#0891b2",
    },
  },
  {
    timestamps: true,
  }
);

export const getWidgetSettingsModel = (tenantConnection) => {
  if (tenantConnection.models.WidgetSettings) {
    return tenantConnection.models.WidgetSettings;
  }

  return tenantConnection.model("WidgetSettings", widgetSettingsSchema);
};