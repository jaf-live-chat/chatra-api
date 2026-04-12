import expressAsyncHandler from "express-async-handler";
import { USER_ROLES } from "../../constants/constants.js";
import liveChatServices from "../../services/tenant/liveChatServices.js";
import quickMessageServices from "../../services/tenant/quickMessageServices.js";
import widgetSettingsServices from "../../services/tenant/widgetSettingsServices.js";
import { logger } from "../../utils/logger.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const startWidgetConversation = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.createConversation(
      {
        databaseName: resolveTenantDatabaseName(req),
        fullName: req.body?.fullName,
        name: req.body?.name,
        emailAddress: req.body?.emailAddress,
        phoneNumber: req.body?.phoneNumber,
        ipAddressConsent: req.body?.ipAddressConsent,
        message: req.body?.message,
        visitorToken: req.body?.visitorToken,
        locationConsent: req.body?.locationConsent,
        browserLatitude: req.body?.browserLatitude,
        browserLongitude: req.body?.browserLongitude,
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
      location: response.location,
    });
  } catch (error) {
    logger.error(`Error starting widget conversation: ${error.message}`);
    throw error;
  }
});

const endWidgetConversation = expressAsyncHandler(async (req, res) => {
  try {
    const response = await liveChatServices.endConversation(
      {
        databaseName: resolveTenantDatabaseName(req),
        conversationId: req.params.id,
        visitorToken: req.body?.visitorToken,
      },
      req,
    );

    res.status(200).json({
      success: true,
      message: "Conversation ended successfully.",
      conversation: response.conversation,
      queueEntry: response.queueEntry,
      visitor: response.visitor,
      agent: response.agent,
      location: response.location,
    });
  } catch (error) {
    logger.error(`Error ending widget conversation: ${error.message}`);
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

const getWidgetQuickMessages = expressAsyncHandler(async (req, res) => {
  try {
    const response = await quickMessageServices.getQuickMessagesByQuery({
      databaseName: resolveTenantDatabaseName(req),
      page: req.query?.page,
      limit: req.query?.limit,
    });

    res.status(200).json({
      success: true,
      count: response.quickMessages.length,
      totalCount: response.totalCount,
      page: response.page,
      limit: response.limit,
      totalPages: response.totalPages,
      hasNextPage: response.hasNextPage,
      hasPreviousPage: response.hasPreviousPage,
      quickMessages: response.quickMessages,
    });
  } catch (error) {
    logger.error(`Error fetching widget quick messages: ${error.message}`);
    throw error;
  }
});

const getWidgetSettings = expressAsyncHandler(async (req, res) => {
  try {
    const response = await widgetSettingsServices.getWidgetSettings({
      databaseName: resolveTenantDatabaseName(req),
    });

    res.status(200).json({
      success: true,
      widgetSettings: response.widgetSettings,
    });
  } catch (error) {
    logger.error(`Error fetching widget settings: ${error.message}`);
    throw error;
  }
});

export {
  startWidgetConversation,
  sendWidgetMessage,
  endWidgetConversation,
  getWidgetMessagesByConversationId,
  getWidgetQuickMessages,
  getWidgetSettings,
};
