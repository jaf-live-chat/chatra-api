import express from "express";
import {
  createQuickMessage,
  deleteQuickMessageById,
  getQuickMessageById,
  getQuickMessagesByQuery,
  updateQuickMessageById,
} from "../../controllers/tenant/quickMessageControllers.js";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import {
  createQuickMessageValidator,
  updateQuickMessageValidator,
} from "../../validations/tenant/quickMessageValidator.js";

const router = express.Router();

router.get("/", tenantAuth, protect, adminAuth, getQuickMessagesByQuery);
router.post(
  "/",
  tenantAuth,
  protect,
  adminAuth,
  createQuickMessageValidator,
  createQuickMessage,
);
router.get("/:id", tenantAuth, protect, adminAuth, getQuickMessageById);
router.put(
  "/:id",
  tenantAuth,
  protect,
  adminAuth,
  updateQuickMessageValidator,
  updateQuickMessageById,
);
router.delete("/:id", tenantAuth, protect, adminAuth, deleteQuickMessageById);

export default router;
