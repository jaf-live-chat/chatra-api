import mongoose from "mongoose";
import { getTenantConnection } from "../../config/tenantDB.js";
import { AppError, BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { CONVERSATION_STATUS } from "../../constants/constants.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const normalizeText = (value, fallback = "") => String(value ?? fallback).trim();

const ensureDatabaseName = (databaseName) => {
  if (!databaseName) {
    throw new BadRequestError("databaseName is required.");
  }
};

const parsePagination = (page, limit) => {
  const pageNumber = Math.max(1, Number.parseInt(String(page || DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limitNumber = Math.max(1, Math.min(100, Number.parseInt(String(limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber,
  };
};

const safeObject = (value) => {
  if (!value) {
    return null;
  }

  return typeof value.toObject === "function" ? value.toObject() : { ...value };
};

const sanitizeFeedback = (feedback) => {
  const feedbackObject = safeObject(feedback);

  if (!feedbackObject) {
    return null;
  }

  return {
    ...feedbackObject,
    comment: normalizeText(feedbackObject.comment) || null,
  };
};

const resolveVisitorToken = (req, payload = {}) => normalizeText(req.headers?.["x-visitor-id"] || payload.visitorToken || payload.visitorId);

const getTenantModels = (databaseName) => {
  ensureDatabaseName(databaseName);
  return getTenantConnection(databaseName);
};

const recalculateAgentRating = async (databaseName, agentId) => {
  const { Agents, ConversationFeedback } = getTenantModels(databaseName);

  const aggregate = await ConversationFeedback.aggregate([
    {
      $match: {
        agentId: new mongoose.Types.ObjectId(agentId),
      },
    },
    {
      $group: {
        _id: "$agentId",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const summary = aggregate[0] || {
    averageRating: 0,
    ratingCount: 0,
  };

  const updatedAgent = await Agents.findByIdAndUpdate(
    agentId,
    {
      averageRating: Number(summary.averageRating || 0),
      ratingCount: Number(summary.ratingCount || 0),
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-password").lean();

  return {
    averageRating: Number(summary.averageRating || 0),
    ratingCount: Number(summary.ratingCount || 0),
    agent: updatedAgent,
  };
};

const getAgentFeedbackSummary = async (payload = {}) => {
  try {
    const { databaseName, agentId, page, limit } = payload;
    ensureDatabaseName(databaseName);

    if (!agentId) {
      throw new BadRequestError("agentId is required.");
    }

    const { ConversationFeedback } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);

    const query = {
      agentId: new mongoose.Types.ObjectId(agentId),
    };

    const [summary, feedbacks, totalCount] = await Promise.all([
      ConversationFeedback.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: "$agentId",
            averageRating: { $avg: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ]),
      ConversationFeedback.find(query)
        .populate("visitorId")
        .populate("conversationId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      ConversationFeedback.countDocuments(query),
    ]);

    const summaryEntry = summary[0] || {
      averageRating: 0,
      ratingCount: 0,
    };

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      summary: {
        averageRating: Number(summaryEntry.averageRating || 0),
        ratingCount: Number(summaryEntry.ratingCount || 0),
      },
      feedbacks: feedbacks.map(sanitizeFeedback),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching agent feedback summary: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch agent feedback summary: ${error.message}`);
  }
};

const getConversationFeedbackMap = async (databaseName, conversationIds = []) => {
  const { ConversationFeedback } = getTenantModels(databaseName);
  const normalizedConversationIds = [...new Set(conversationIds.map((entry) => normalizeText(entry)).filter(Boolean))];

  if (normalizedConversationIds.length === 0) {
    return new Map();
  }

  const feedbacks = await ConversationFeedback.find({
    conversationId: { $in: normalizedConversationIds },
  })
    .sort({ createdAt: -1 })
    .lean();

  return new Map(
    feedbacks.map((feedback) => [
      String(feedback.conversationId || ""),
      {
        rating: Number(feedback.rating || 0),
        comment: normalizeText(feedback.comment) || null,
        createdAt: feedback.createdAt || null,
      },
    ]),
  );
};

const submitConversationFeedback = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId } = payload;
    ensureDatabaseName(databaseName);

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    const parsedRating = Number.parseInt(String(payload.rating ?? ""), 10);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      throw new BadRequestError("rating must be between 1 and 5.");
    }

    const comment = normalizeText(payload.comment);
    if (comment.length > 500) {
      throw new BadRequestError("comment must be 500 characters or less.");
    }

    const { Conversations, ConversationFeedback } = getTenantModels(databaseName);
    const conversation = await Conversations.findById(conversationId)
      .populate("visitorId")
      .populate("agentId")
      .lean();

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    if (String(conversation.status || "").toUpperCase() !== CONVERSATION_STATUS.ENDED) {
      throw new BadRequestError("Conversation must be ended before feedback can be submitted.");
    }

    const requestVisitorToken = resolveVisitorToken(req, payload);
    const conversationVisitorToken = normalizeText(conversation.visitorToken);

    if (!requestVisitorToken || (conversationVisitorToken && conversationVisitorToken !== requestVisitorToken)) {
      throw new ForbiddenError("Conversation access denied for this visitor token.");
    }

    const agentId = String(conversation.agentId?._id || conversation.agentId || "").trim();
    const visitorId = String(conversation.visitorId?._id || conversation.visitorId || "").trim();

    if (!agentId) {
      throw new BadRequestError("Conversation is not assigned to an agent.");
    }

    if (!visitorId) {
      throw new BadRequestError("Visitor is required for feedback submission.");
    }

    const existingFeedback = await ConversationFeedback.findOne({ conversationId }).lean();
    if (existingFeedback) {
      throw new ConflictError("This conversation has already been rated.");
    }

    const [createdFeedback] = await ConversationFeedback.create([
      {
        conversationId,
        visitorId,
        agentId,
        rating: parsedRating,
        comment: comment || null,
      },
    ]);

    const summary = await recalculateAgentRating(databaseName, agentId);

    return {
      feedback: sanitizeFeedback(createdFeedback),
      summary,
    };
  } catch (error) {
    logger.error(`Error submitting conversation feedback: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    if (error?.code === 11000) {
      throw new ConflictError("This conversation has already been rated.");
    }

    throw new InternalServerError(`Failed to submit conversation feedback: ${error.message}`);
  }
};

export {
  getAgentFeedbackSummary,
  getConversationFeedbackMap,
  submitConversationFeedback,
  recalculateAgentRating,
};

export default {
  getAgentFeedbackSummary,
  getConversationFeedbackMap,
  submitConversationFeedback,
  recalculateAgentRating,
};