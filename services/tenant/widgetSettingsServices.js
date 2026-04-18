import { getTenantConnection } from "../../config/tenantDB.js";
import {
  AppError,
  BadRequestError,
  InternalServerError,
} from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const DEFAULT_WIDGET_ACCENT_COLOR = "#0891b2";

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

const normalizeText = (value) => String(value || "").trim();

const resolveDefaultWidgetSettings = (companyName) => {
  const resolvedCompanyName = normalizeText(companyName);

  return {
    widgetLogo: "",
    widgetTitle: resolvedCompanyName ? `${resolvedCompanyName}` : "Support",
    welcomeMessage: `Hi there. Welcome to ${resolvedCompanyName || "our support team"}. How can I help you today?`,
    accentColor: DEFAULT_WIDGET_ACCENT_COLOR,
  };
};

const ensureDatabaseName = (databaseName) => {
  if (!databaseName) {
    throw new BadRequestError("databaseName is required.");
  }
};

const sanitizeWidgetSettings = (widgetSettings = {}, defaults = resolveDefaultWidgetSettings()) => {
  const settingsObject =
    typeof widgetSettings.toObject === "function"
      ? widgetSettings.toObject()
      : { ...widgetSettings };

  return {
    _id: settingsObject._id,
    widgetLogo: normalizeText(settingsObject.widgetLogo) || defaults.widgetLogo,
    widgetTitle: normalizeText(settingsObject.widgetTitle) || defaults.widgetTitle,
    welcomeMessage: normalizeText(settingsObject.welcomeMessage) || defaults.welcomeMessage,
    accentColor: normalizeText(settingsObject.accentColor) || defaults.accentColor,
    createdAt: settingsObject.createdAt,
    updatedAt: settingsObject.updatedAt,
  };
};

const buildUpdatePayload = (payload = {}, defaults = resolveDefaultWidgetSettings()) => {
  const updatePayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, "widgetLogo")) {
    updatePayload.widgetLogo = normalizeText(payload.widgetLogo);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "widgetTitle")) {
    updatePayload.widgetTitle = normalizeText(payload.widgetTitle);
    if (!updatePayload.widgetTitle) {
      throw new BadRequestError("widgetTitle is required.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "welcomeMessage")) {
    updatePayload.welcomeMessage = normalizeText(payload.welcomeMessage);
    if (!updatePayload.welcomeMessage) {
      throw new BadRequestError("welcomeMessage is required.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "accentColor")) {
    updatePayload.accentColor = normalizeText(payload.accentColor);

    if (!updatePayload.accentColor) {
      updatePayload.accentColor = defaults.accentColor;
    }

    if (!HEX_COLOR_REGEX.test(updatePayload.accentColor)) {
      throw new BadRequestError("accentColor must be a valid hex color.");
    }
  }

  return updatePayload;
};

const getWidgetSettings = async (payload = {}) => {
  try {
    const { databaseName, companyName } = payload;
    ensureDatabaseName(databaseName);
    const defaults = resolveDefaultWidgetSettings(companyName);

    const { WidgetSettings } = getTenantConnection(databaseName);

    const widgetSettings = await WidgetSettings.findOne().lean();

    if (!widgetSettings) {
      return {
        widgetSettings: sanitizeWidgetSettings(defaults, defaults),
      };
    }

    return {
      widgetSettings: sanitizeWidgetSettings(widgetSettings, defaults),
    };
  } catch (error) {
    logger.error(`Error fetching widget settings: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(
      `Failed to fetch widget settings: ${error.message}`,
    );
  }
};

const updateWidgetSettings = async (payload = {}) => {
  try {
    const { databaseName, updateData, companyName } = payload;
    ensureDatabaseName(databaseName);
    const defaults = resolveDefaultWidgetSettings(companyName);

    const nextUpdateData = buildUpdatePayload(updateData || {}, defaults);

    if (Object.keys(nextUpdateData).length === 0) {
      throw new BadRequestError(
        "At least one field is required to update widget settings.",
      );
    }

    const { WidgetSettings } = getTenantConnection(databaseName);

    const widgetSettings = await WidgetSettings.findOneAndUpdate(
      {},
      {
        $set: nextUpdateData,
        $setOnInsert: {
          widgetLogo: defaults.widgetLogo,
          widgetTitle: defaults.widgetTitle,
          welcomeMessage: defaults.welcomeMessage,
          accentColor: defaults.accentColor,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).lean();

    return {
      widgetSettings: sanitizeWidgetSettings(widgetSettings, defaults),
    };
  } catch (error) {
    logger.error(`Error updating widget settings: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(
      `Failed to update widget settings: ${error.message}`,
    );
  }
};

export default {
  getWidgetSettings,
  updateWidgetSettings,
};
