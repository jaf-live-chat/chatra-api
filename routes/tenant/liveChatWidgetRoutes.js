import express from "express";
import {
  getWidgetMessagesByConversationId,
  getWidgetQuickMessages,
  getWidgetSettings,
  sendWidgetMessage,
  startWidgetConversation,
} from "../../controllers/tenant/liveChatWidgetControllers.js";
import liveChatWidgetAuth from "../../middlewares/liveChatWidgetAuthMiddleware.js";
import liveChatWidgetRateLimit from "../../middlewares/liveChatWidgetRateLimitMiddleware.js";
import {
  getWidgetMessagesValidator,
  getWidgetQuickMessagesValidator,
  sendWidgetMessageValidator,
  startWidgetConversationValidator,
} from "../../validations/tenant/liveChatWidgetValidator.js";

const router = express.Router();

router.use(liveChatWidgetAuth, liveChatWidgetRateLimit);

router.post("/conversations/start", startWidgetConversationValidator, startWidgetConversation);
router.post("/messages", sendWidgetMessageValidator, sendWidgetMessage);
router.get("/messages/:conversationId", getWidgetMessagesValidator, getWidgetMessagesByConversationId);
router.get("/quick-messages", getWidgetQuickMessagesValidator, getWidgetQuickMessages);
router.get("/settings", getWidgetSettings);

export default router;
