import expressAsyncHandler from "express-async-handler";
import widgetSettingsServices from "../../services/tenant/widgetSettingsServices.js";
import { uploadToCloudinary } from "../../utils/fileUploadService.js";
import { logger } from "../../utils/logger.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const getPortalWidgetSettings = expressAsyncHandler(async (req, res) => {
  try {
    const response = await widgetSettingsServices.getWidgetSettings({
      databaseName: resolveTenantDatabaseName(req),
    });

    res.status(200).json({
      success: true,
      widgetSettings: response.widgetSettings,
    });
  } catch (error) {
    logger.error(`Error fetching portal widget settings: ${error.message}`);
    throw error;
  }
});

const updatePortalWidgetSettings = expressAsyncHandler(async (req, res) => {
  try {
    const updateData = { ...(req.body || {}) };

    if (req.file) {
      const uploadedLogo = await uploadToCloudinary(req.file, {
        folder: "jaf-chatra/widget-logos",
        fileCategory: "IMAGES",
        resource_type: "image",
      });

      updateData.widgetLogo = uploadedLogo.url;
    }

    const response = await widgetSettingsServices.updateWidgetSettings({
      databaseName: resolveTenantDatabaseName(req),
      updateData,
    });

    res.status(200).json({
      success: true,
      message: "Widget settings updated successfully.",
      widgetSettings: response.widgetSettings,
    });
  } catch (error) {
    logger.error(`Error updating portal widget settings: ${error.message}`);
    throw error;
  }
});

const getWidgetRuntimeSettings = expressAsyncHandler(async (req, res) => {
  try {
    const response = await widgetSettingsServices.getWidgetSettings({
      databaseName: resolveTenantDatabaseName(req),
    });

    res.status(200).json({
      success: true,
      widgetSettings: response.widgetSettings,
    });
  } catch (error) {
    logger.error(`Error fetching widget runtime settings: ${error.message}`);
    throw error;
  }
});

export {
  getPortalWidgetSettings,
  updatePortalWidgetSettings,
  getWidgetRuntimeSettings,
};
