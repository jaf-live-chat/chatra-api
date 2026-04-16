import express from "express";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import { liveChatStaffAuth } from "../../middlewares/liveChatAuthMiddleware.js";
import {
  acceptConversation,
  assignConversation,
  endConversation,
  getActiveConversations,
  getConversationHistory,
  getAnalyticsSummary,
  getMessagesByConversationId,
  getQueue,
  getVisitorById,
  getVisitors,
  sendMessage,
  startConversation,
  transferConversation,
} from "../../controllers/tenant/liveChatControllers.js";
import {
  getVisitorByIdValidator,
  getVisitorsValidator,
} from "../../validations/tenant/liveChatValidator.js";

const router = express.Router();

router.post("/conversations/start", tenantAuth, startConversation);
router.get("/queue", tenantAuth, protect, liveChatStaffAuth, getQueue);
router.get("/conversations/active", tenantAuth, protect, liveChatStaffAuth, getActiveConversations);
router.get("/conversations/history", tenantAuth, protect, liveChatStaffAuth, getConversationHistory);
router.get("/analytics/summary", tenantAuth, protect, liveChatStaffAuth, getAnalyticsSummary);
router.get("/visitors", tenantAuth, protect, liveChatStaffAuth, getVisitorsValidator, getVisitors);
router.get("/visitors/:id", tenantAuth, protect, liveChatStaffAuth, getVisitorByIdValidator, getVisitorById);
router.post("/conversations/:id/assign", tenantAuth, protect, adminAuth, assignConversation);
router.post("/conversations/:id/accept", tenantAuth, protect, liveChatStaffAuth, acceptConversation);
router.post("/conversations/:id/transfer", tenantAuth, protect, adminAuth, transferConversation);
router.post("/conversations/:id/end", tenantAuth, protect, liveChatStaffAuth, endConversation);
router.post("/messages", tenantAuth, sendMessage);
router.get("/messages/:conversationId", tenantAuth, protect, liveChatStaffAuth, getMessagesByConversationId);

export default router;