import expressAsyncHandler from "express-async-handler";
import quickMessageServices from "../../services/tenant/quickMessageServices.js";
import { logger } from "../../utils/logger.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const getQuickMessagesByQuery = expressAsyncHandler(async (req, res) => {
  try {
    const quickMessagesResult = await quickMessageServices.getQuickMessagesByQuery({
      databaseName: resolveTenantDatabaseName(req),
      page: req.query?.page,
      limit: req.query?.limit,
    });

    res.status(200).json({
      success: true,
      count: quickMessagesResult.quickMessages.length,
      totalCount: quickMessagesResult.totalCount,
      page: quickMessagesResult.page,
      limit: quickMessagesResult.limit,
      totalPages: quickMessagesResult.totalPages,
      hasNextPage: quickMessagesResult.hasNextPage,
      hasPreviousPage: quickMessagesResult.hasPreviousPage,
      quickMessages: quickMessagesResult.quickMessages,
    });
  } catch (error) {
    logger.error(`Error fetching quick messages: ${error.message}`);
    throw error;
  }
});

const createQuickMessage = expressAsyncHandler(async (req, res) => {
  try {
    const quickMessage = await quickMessageServices.createQuickMessage({
      databaseName: resolveTenantDatabaseName(req),
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: "Quick message created successfully.",
      quickMessage,
    });
  } catch (error) {
    logger.error(`Error creating quick message: ${error.message}`);
    throw error;
  }
});

const getQuickMessageById = expressAsyncHandler(async (req, res) => {
  try {
    const quickMessage = await quickMessageServices.getQuickMessageById({
      databaseName: resolveTenantDatabaseName(req),
      quickMessageId: req.params.id,
    });

    res.status(200).json({
      success: true,
      quickMessage,
    });
  } catch (error) {
    logger.error(`Error fetching quick message by id: ${error.message}`);
    throw error;
  }
});

const updateQuickMessageById = expressAsyncHandler(async (req, res) => {
  try {
    const quickMessage = await quickMessageServices.updateQuickMessageById({
      databaseName: resolveTenantDatabaseName(req),
      quickMessageId: req.params.id,
      updateData: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Quick message updated successfully.",
      quickMessage,
    });
  } catch (error) {
    logger.error(`Error updating quick message: ${error.message}`);
    throw error;
  }
});

const deleteQuickMessageById = expressAsyncHandler(async (req, res) => {
  try {
    await quickMessageServices.deleteQuickMessageById({
      databaseName: resolveTenantDatabaseName(req),
      quickMessageId: req.params.id,
    });

    res.status(200).json({
      success: true,
      message: "Quick message deleted successfully.",
    });
  } catch (error) {
    logger.error(`Error deleting quick message: ${error.message}`);
    throw error;
  }
});

export {
  getQuickMessagesByQuery,
  createQuickMessage,
  getQuickMessageById,
  updateQuickMessageById,
  deleteQuickMessageById,
};