import express from "express";
import {
  getWidgetVisitorProfile,
  updateWidgetVisitorProfile,
  getWidgetConversationHistory,
  endWidgetConversation,
  getWidgetMessagesByConversationId,
  getWidgetQuickMessages,
  getWidgetSettings,
  sendWidgetMessage,
  startWidgetConversation,
  submitWidgetConversationFeedback,
} from "../../controllers/tenant/liveChatWidgetControllers.js";
import liveChatWidgetAuth from "../../middlewares/liveChatWidgetAuthMiddleware.js";
import liveChatWidgetRateLimit from "../../middlewares/liveChatWidgetRateLimitMiddleware.js";
import {
  getWidgetMessagesValidator,
  getWidgetConversationHistoryValidator,
  getWidgetVisitorProfileValidator,
  getWidgetQuickMessagesValidator,
  endWidgetConversationValidator,
  submitWidgetConversationFeedbackValidator,
  sendWidgetMessageValidator,
  startWidgetConversationValidator,
  updateWidgetVisitorProfileValidator,
} from "../../validations/tenant/liveChatWidgetValidator.js";

const router = express.Router();

router.use(liveChatWidgetAuth, liveChatWidgetRateLimit);

router.post("/conversations/start", startWidgetConversationValidator, startWidgetConversation);
router.post("/conversations/:id/end", endWidgetConversationValidator, endWidgetConversation);
router.post("/conversations/:conversationId/feedback", submitWidgetConversationFeedbackValidator, submitWidgetConversationFeedback);
router.get("/conversations/history", getWidgetConversationHistoryValidator, getWidgetConversationHistory);
router.get("/visitor-profile", getWidgetVisitorProfileValidator, getWidgetVisitorProfile);
router.patch("/visitor-profile", updateWidgetVisitorProfileValidator, updateWidgetVisitorProfile);
router.post("/messages", sendWidgetMessageValidator, sendWidgetMessage);
router.get("/messages/:conversationId", getWidgetMessagesValidator, getWidgetMessagesByConversationId);
router.get("/quick-messages", getWidgetQuickMessagesValidator, getWidgetQuickMessages);
router.get("/settings", getWidgetSettings);

export default router;
