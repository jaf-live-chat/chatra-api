import expressAsyncHandler from "express-async-handler";
import liveChatServices from "../../services/tenant/liveChatServices.js";
import { logger } from "../../utils/logger.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const startConversation = expressAsyncHandler(async (req, res) => {
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
    logger.error(`Error starting conversation: ${error.message}`);
    throw error;
  }
});

const getQueue = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.getQueue({
      databaseName: resolveTenantDatabaseName(req),
      page: req.query?.page,
      limit: req.query?.limit,
    });

    res.status(200).json({
      success: true,
      ...response,
    });
  } catch (error) {
    logger.error(`Error fetching queue: ${error.message}`);
    throw error;
  }
});

const assignConversation = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.assignConversation(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.params.id,
        agentId: req.body?.agentId,
      },
      req,
    );

    res.status(200).json({
      success: true,
      message: "Conversation assigned successfully.",
      conversation: response.conversation,
      queueEntry: response.queueEntry,
      visitor: response.visitor,
      agent: response.agent,
      initialMessage: response.initialMessage,
    });
  } catch (error) {
    logger.error(`Error assigning conversation: ${error.message}`);
    throw error;
  }
});

const acceptConversation = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.acceptConversation(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.params.id,
      },
      req,
    );

    res.status(200).json({
      success: true,
      message: "Conversation accepted successfully.",
      conversation: response.conversation,
      queueEntry: response.queueEntry,
      visitor: response.visitor,
      agent: response.agent,
      initialMessage: response.initialMessage,
    });
  } catch (error) {
    logger.error(`Error accepting conversation: ${error.message}`);
    throw error;
  }
});

const sendMessage = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.sendMessage(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.body?.conversationId,
        message: req.body?.message,
        senderType: req.body?.senderType,
        senderId: req.body?.senderId,
      },
      req,
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      messageData: response,
    });
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    throw error;
  }
});

const getMessagesByConversationId = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.getMessagesByConversationId(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.params.conversationId,
        page: req.query?.page,
        limit: req.query?.limit,
      },
      req,
    );

    res.status(200).json({
      success: true,
      ...response,
    });
  } catch (error) {
    logger.error(`Error fetching messages: ${error.message}`);
    throw error;
  }
});

export {
  startConversation,
  getQueue,
  assignConversation,
  acceptConversation,
  sendMessage,
  getMessagesByConversationId,
};