import expressAsyncHandler from "express-async-handler";
import chatSettingsServices from "../../services/tenant/chatSettingsServices.js";
import { InternalServerError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const resolveDatabaseName = (req) => {
  const databaseName = req.tenant?.databaseName;

  if (!databaseName) {
    throw new InternalServerError("Unable to resolve tenant database.");
  }

  return databaseName;
};

const getQueueAssignmentMode = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveDatabaseName(req);
    const response = await chatSettingsServices.getAssignmentMode({
      databaseName,
    });

    res.status(200).json({
      success: true,
      message: "Queue assignment mode retrieved successfully.",
      chatSettings: response.chatSettings,
    });
  } catch (error) {
    logger.error(`Error retrieving queue assignment mode: ${error.message}`);
    throw error;
  }
});

const updateQueueAssignmentMode = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveDatabaseName(req);
    const response = await chatSettingsServices.updateAssignmentMode({
      databaseName,
      assignmentMode: req.body?.assignmentMode,
    });

    res.status(200).json({
      success: true,
      message: "Queue assignment mode updated successfully.",
      chatSettings: response.chatSettings,
    });
  } catch (error) {
    logger.error(`Error updating queue assignment mode: ${error.message}`);
    throw error;
  }
});

export {
  getQueueAssignmentMode,
  updateQueueAssignmentMode,
};
