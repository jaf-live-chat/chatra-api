import expressAsyncHandler from "express-async-handler";
import { USER_ROLES } from "../../constants/constants.js";
import liveChatServices from "../../services/tenant/liveChatServices.js";
import { logger } from "../../utils/logger.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const startWidgetConversation = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.createConversation(
      {
        databaseName: resolveTenantDatabaseName(req),
        name: req.body?.name,
        emailAddress: req.body?.emailAddress,
        message: req.body?.message,
        visitorToken: req.body?.visitorToken,
      },
      req,
    );

    res.status(201).json({
      success: true,
      message: "Conversation started successfully.",
      conversation: response.conversation,
      queueEntry: response.queueEntry,
      visitor: response.visitor,
      agent: response.agent,
      initialMessage: response.initialMessage,
    });
  } catch (error) {
    logger.error(`Error starting widget conversation: ${error.message}`);
    throw error;
  }
});

const sendWidgetMessage = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.sendMessage(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.body?.conversationId,
        message: req.body?.message,
        senderType: USER_ROLES.VISITOR.value,
        visitorToken: req.body?.visitorToken,
      },
      req,
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      messageData: response,
    });
  } catch (error) {
    logger.error(`Error sending widget message: ${error.message}`);
    throw error;
  }
});

const getWidgetMessagesByConversationId = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.getMessagesByConversationId(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.params.conversationId,
        page: req.query?.page,
        limit: req.query?.limit,
        visitorToken: req.query?.visitorToken || req.body?.visitorToken,
      },
      req,
    );

    res.status(200).json({
      success: true,
      ...response,
    });
  } catch (error) {
    logger.error(`Error fetching widget messages: ${error.message}`);
    throw error;
  }
});

export {
  startWidgetConversation,
  sendWidgetMessage,
  getWidgetMessagesByConversationId,
};
