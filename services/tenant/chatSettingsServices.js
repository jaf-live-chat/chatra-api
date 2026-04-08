import { getTenantConnection } from "../../config/tenantDB.js";
import { AppError, BadRequestError, InternalServerError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const ALLOWED_ASSIGNMENT_MODES = ["MANUAL", "ROUND_ROBIN"];

const ensureDatabaseName = (databaseName) => {
  if (!databaseName) {
    throw new BadRequestError("databaseName is required.");
  }
};

const sanitizeChatSettings = (chatSettings) => {
  if (!chatSettings) return null;

  const settingsObject =
    typeof chatSettings.toObject === "function"
      ? chatSettings.toObject()
      : { ...chatSettings };

  return {
    _id: settingsObject._id,
    assignmentMode: settingsObject.assignmentMode,
    createdAt: settingsObject.createdAt,
    updatedAt: settingsObject.updatedAt,
  };
};

const getAssignmentMode = async (payload = {}) => {
  try {
    const { databaseName } = payload;

    ensureDatabaseName(databaseName);

    const { ChatSettings } = getTenantConnection(databaseName);

    const chatSettings = await ChatSettings.findOne().lean();

    if (!chatSettings) {
      return {
        chatSettings: sanitizeChatSettings({
          assignmentMode: "ROUND_ROBIN",
        }),
      };
    }

    return {
      chatSettings: sanitizeChatSettings(chatSettings),
    };
  } catch (error) {
    logger.error(`Error retrieving chat assignment mode: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to retrieve chat assignment mode: ${error.message}`);
  }
};

const updateAssignmentMode = async (payload = {}) => {
  try {
    const { databaseName, assignmentMode } = payload;

    ensureDatabaseName(databaseName);

    const normalizedMode = String(assignmentMode || "").trim().toUpperCase();

    if (!normalizedMode) {
      throw new BadRequestError("assignmentMode is required.");
    }

    if (!ALLOWED_ASSIGNMENT_MODES.includes(normalizedMode)) {
      throw new BadRequestError("assignmentMode must be either MANUAL or ROUND_ROBIN.");
    }

    const { ChatSettings } = getTenantConnection(databaseName);

    const updatedChatSettings = await ChatSettings.findOneAndUpdate(
      {},
      { assignmentMode: normalizedMode },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).lean();

    return {
      chatSettings: sanitizeChatSettings(updatedChatSettings),
    };
  } catch (error) {
    logger.error(`Error updating chat assignment mode: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update chat assignment mode: ${error.message}`);
  }
};

export default {
  getAssignmentMode,
  updateAssignmentMode,
};
