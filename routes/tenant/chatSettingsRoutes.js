import express from "express";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import { getQueueAssignmentMode, updateQueueAssignmentMode } from "../../controllers/tenant/chatSettingsControllers.js";
import { updateQueueAssignmentModeValidator } from "../../validations/tenant/chatSettingsValidator.js";

const router = express.Router();

router.get(
  "/assignment-mode",
  tenantAuth,
  protect,
  getQueueAssignmentMode
);

router.patch(
  "/assignment-mode",
  tenantAuth,
  protect,
  adminAuth,
  updateQueueAssignmentModeValidator,
  updateQueueAssignmentMode
);

export default router;
