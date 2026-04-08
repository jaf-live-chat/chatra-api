import { getTenantConnection } from "../../config/tenantDB.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalServerError,
} from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const sanitizeQuickReply = (quickReply) => {
  if (!quickReply) return null;

  const replyObject = typeof quickReply.toObject === "function" ? quickReply.toObject() : { ...quickReply };
  return replyObject;
};

const parseBooleanValue = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "posted"].includes(normalized)) return true;
  if (["false", "0", "no", "draft"].includes(normalized)) return false;

  return undefined;
};

const normalizeQuickReplyData = (payload) => {
  const data = payload && typeof payload === "object" ? payload : {};
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(data, "title")) {
    updateData.title = String(data.title || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "category")) {
    updateData.category = String(data.category || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "message")) {
    updateData.message = String(data.message || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "isPosted")) {
    const parsed = parseBooleanValue(data.isPosted);
    if (parsed !== undefined) {
      updateData.isPosted = parsed;
    }
  }

  return updateData;
};

const getQuickReplies = async (payload) => {
  try {
    const {
      databaseName,
      page = 1,
      limit = 10,
      search = "",
      category = "",
      isPosted,
    } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;
    const { QuickReplies } = getTenantConnection(databaseName);

    const replyStatus = parseBooleanValue(isPosted);
    const filters = [];

    if (search) {
      filters.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (category) {
      filters.push({ category: { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
    }

    if (replyStatus !== undefined) {
      filters.push({ isPosted: replyStatus });
    }

    const query = filters.length > 0 ? { $and: filters } : {};

    const [quickReplies, total] = await Promise.all([
      QuickReplies.find(query)
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean(),
      QuickReplies.countDocuments(query),
    ]);

    return {
      quickReplies: quickReplies.map(sanitizeQuickReply),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        limit: limitNum,
      },
    };
  } catch (error) {
    logger.error(`Error fetching quick replies: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch quick replies: ${error.message}`);
  }
};

const getQuickReplyById = async (payload) => {
  try {
    const { databaseName, quickReplyId } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required");
    }

    const { QuickReplies } = getTenantConnection(databaseName);
    const quickReply = await QuickReplies.findById(quickReplyId).lean();

    if (!quickReply) {
      throw new AppError("Quick reply not found", 404);
    }

    return { quickReply: sanitizeQuickReply(quickReply) };
  } catch (error) {
    logger.error(`Error fetching quick reply: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch quick reply: ${error.message}`);
  }
};

const createQuickReply = async (payload) => {
  try {
    const { databaseName, quickReplyData } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    const normalizedData = normalizeQuickReplyData(quickReplyData);

    if (!normalizedData.title) {
      throw new BadRequestError("title is required");
    }

    if (!normalizedData.category) {
      throw new BadRequestError("category is required");
    }

    if (!normalizedData.message) {
      throw new BadRequestError("message is required");
    }

    const { QuickReplies } = getTenantConnection(databaseName);

    const existingReply = await QuickReplies.findOne({
      title: { $regex: `^${normalizedData.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).lean();

    if (existingReply) {
      throw new ConflictError("A quick reply with this title already exists.");
    }

    const createdQuickReply = await QuickReplies.create({
      title: normalizedData.title,
      category: normalizedData.category,
      message: normalizedData.message,
      isPosted: normalizedData.isPosted ?? false,
    });

    return { quickReply: sanitizeQuickReply(createdQuickReply) };
  } catch (error) {
    logger.error(`Error creating quick reply: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create quick reply: ${error.message}`);
  }
};

const updateQuickReply = async (payload) => {
  try {
    const { databaseName, quickReplyId, updateData } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required");
    }

    const normalizedData = normalizeQuickReplyData(updateData);

    if (Object.keys(normalizedData).length === 0) {
      throw new BadRequestError("At least one field is required to update quick reply");
    }

    const { QuickReplies } = getTenantConnection(databaseName);
    const quickReply = await QuickReplies.findById(quickReplyId);

    if (!quickReply) {
      throw new AppError("Quick reply not found", 404);
    }

    if (normalizedData.title && normalizedData.title !== quickReply.title) {
      const existingReply = await QuickReplies.findOne({
        title: { $regex: `^${normalizedData.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        _id: { $ne: quickReplyId },
      }).lean();

      if (existingReply) {
        throw new ConflictError("A quick reply with this title already exists.");
      }
    }

    const updatedQuickReply = await QuickReplies.findByIdAndUpdate(quickReplyId, normalizedData, {
      new: true,
      runValidators: true,
    }).lean();

    return { quickReply: sanitizeQuickReply(updatedQuickReply) };
  } catch (error) {
    logger.error(`Error updating quick reply: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update quick reply: ${error.message}`);
  }
};

const deleteQuickReply = async (payload) => {
  try {
    const { databaseName, quickReplyId } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!quickReplyId) {
      throw new BadRequestError("quickReplyId is required");
    }

    const { QuickReplies } = getTenantConnection(databaseName);
    const deletedQuickReply = await QuickReplies.findByIdAndDelete(quickReplyId).lean();

    if (!deletedQuickReply) {
      throw new AppError("Quick reply not found", 404);
    }

    return { message: "Quick reply deleted successfully." };
  } catch (error) {
    logger.error(`Error deleting quick reply: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to delete quick reply: ${error.message}`);
  }
};

export default {
  getQuickReplies,
  getQuickReplyById,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
};