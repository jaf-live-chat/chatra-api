import express from "express";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import { liveChatStaffAuth } from "../../middlewares/liveChatAuthMiddleware.js";
import {
  acceptConversation,
  assignConversation,
  getMessagesByConversationId,
  getQueue,
  sendMessage,
  startConversation,
} from "../../controllers/tenant/liveChatControllers.js";

const router = express.Router();

router.post("/conversations/start", tenantAuth, startConversation);
router.get("/queue", tenantAuth, protect, liveChatStaffAuth, getQueue);
router.post("/conversations/:id/assign", tenantAuth, protect, adminAuth, assignConversation);
router.post("/conversations/:id/accept", tenantAuth, protect, liveChatStaffAuth, acceptConversation);
router.post("/messages", tenantAuth, sendMessage);
router.get("/messages/:conversationId", tenantAuth, getMessagesByConversationId);

export default router;