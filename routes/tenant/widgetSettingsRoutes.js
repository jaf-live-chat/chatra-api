import express from "express";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import { uploadSingle } from "../../middlewares/fileUploadMiddleware.js";
import {
  getPortalWidgetSettings,
  updatePortalWidgetSettings,
} from "../../controllers/tenant/widgetSettingsControllers.js";
import { updateWidgetSettingsValidator } from "../../validations/tenant/widgetSettingsValidator.js";

const router = express.Router();

router.get("/", tenantAuth, protect, adminAuth, getPortalWidgetSettings);
router.patch(
  "/",
  tenantAuth,
  protect,
  adminAuth,
  uploadSingle("widgetLogoFile", { fileCategory: "IMAGES" }),
  updateWidgetSettingsValidator,
  updatePortalWidgetSettings,
);

export default router;
