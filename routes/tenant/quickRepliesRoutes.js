import express from "express";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import {
  getQuickReplies,
  getSingleQuickReplyById,
  createQuickReply,
  updateQuickReplyById,
  deleteQuickReply,
} from "../../controllers/tenant/quickRepliesControllers.js";

const router = express.Router();

router.get("/", tenantAuth, protect, getQuickReplies);
router.get("/:id", tenantAuth, protect, getSingleQuickReplyById);
router.post("/", tenantAuth, protect, adminAuth, createQuickReply);
router.put("/:id", tenantAuth, protect, adminAuth, updateQuickReplyById);
router.delete("/:id", tenantAuth, protect, adminAuth, deleteQuickReply);

export default router;