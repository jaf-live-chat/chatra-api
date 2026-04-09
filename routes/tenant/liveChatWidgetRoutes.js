import express from "express";
import {
  getWidgetMessagesByConversationId,
  sendWidgetMessage,
  startWidgetConversation,
} from "../../controllers/tenant/liveChatWidgetControllers.js";
import liveChatWidgetAuth from "../../middlewares/liveChatWidgetAuthMiddleware.js";
import liveChatWidgetRateLimit from "../../middlewares/liveChatWidgetRateLimitMiddleware.js";
import {
  getWidgetMessagesValidator,
  sendWidgetMessageValidator,
  startWidgetConversationValidator,
} from "../../validations/tenant/liveChatWidgetValidator.js";

const router = express.Router();

router.use(liveChatWidgetAuth, liveChatWidgetRateLimit);

router.post("/conversations/start", startWidgetConversationValidator, startWidgetConversation);
router.post("/messages", sendWidgetMessageValidator, sendWidgetMessage);
router.get("/messages/:conversationId", getWidgetMessagesValidator, getWidgetMessagesByConversationId);

export default router;
