import expressAsyncHandler from "express-async-handler";
import { BadRequestError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import quickRepliesServices from "../../services/tenant/quickRepliesServices.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

const resolveAgentId = (req) => {
  const currentAgentId = String(req.agent?._id || "").trim();
  const currentRole = String(req.agent?.role || "").toUpperCase();
  const requestedAgentId = String(req.query?.agentId || "").trim();

  if (currentRole === "SUPPORT_AGENT") {
    return currentAgentId;
  }

  return requestedAgentId || currentAgentId;
};

const getQuickReplies = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);
    const agentId = resolveAgentId(req);
    const response = await quickRepliesServices.getQuickReplies({
      databaseName,
      agentId,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      category: req.query.category,
      isPosted: req.query.isPosted,
    });

    res.status(200).json({
      success: true,
      message: "Quick replies retrieved successfully.",
      quickReplies: response.quickReplies,
      pagination: response.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching quick replies: ${error.message}`);
    throw error;
  }
});

const getSingleQuickReplyById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);
    const agentId = resolveAgentId(req);
    const quickReplyId = String(req.params.id || "");

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required.");
    }

    const response = await quickRepliesServices.getQuickReplyById({
      databaseName,
      agentId,
      quickReplyId,
    });

    res.status(200).json({
      success: true,
      message: "Quick reply retrieved successfully.",
      quickReply: response.quickReply,
    });
  } catch (error) {
    logger.error(`Error fetching quick reply: ${error.message}`);
    throw error;
  }
});

const createQuickReply = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);
    const agentId = resolveAgentId(req);
    const response = await quickRepliesServices.createQuickReply({
      databaseName,
      agentId,
      quickReplyData: req.body,
    });

    res.status(201).json({
      success: true,
      message: "Quick reply created successfully.",
      quickReply: response.quickReply,
    });
  } catch (error) {
    logger.error(`Error creating quick reply: ${error.message}`);
    throw error;
  }
});

const updateQuickReplyById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);
    const agentId = resolveAgentId(req);
    const quickReplyId = String(req.params.id || "");

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required.");
    }

    const response = await quickRepliesServices.updateQuickReply({
      databaseName,
      agentId,
      quickReplyId,
      updateData: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Quick reply updated successfully.",
      quickReply: response.quickReply,
    });
  } catch (error) {
    logger.error(`Error updating quick reply: ${error.message}`);
    throw error;
  }
});

const deleteQuickReply = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);
    const agentId = resolveAgentId(req);
    const quickReplyId = String(req.params.id || "");

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required.");
    }

    const response = await quickRepliesServices.deleteQuickReply({
      databaseName,
      agentId,
      quickReplyId,
    });

    res.status(200).json({
      success: true,
      message: response.message,
    });
  } catch (error) {
    logger.error(`Error deleting quick reply: ${error.message}`);
    throw error;
  }
});

export {
  getQuickReplies,
  getSingleQuickReplyById,
  createQuickReply,
  updateQuickReplyById,
  deleteQuickReply,
};