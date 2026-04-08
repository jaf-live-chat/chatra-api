import { getTenantConnection } from "../../config/tenantDB.js";
import { AppError, BadRequestError, InternalServerError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const normalizeText = (value) => String(value || "").trim();

const ensureDatabaseName = (databaseName) => {
  if (!databaseName) {
    throw new BadRequestError("databaseName is required.");
  }
};

const ensureQuickMessageId = (quickMessageId) => {
  if (!quickMessageId || typeof quickMessageId !== "string") {
    throw new BadRequestError("Quick message id is required.");
  }
};

const parsePositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer.`);
  }

  return parsedValue;
};

const buildUpdatePayload = (payload = {}) => {
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    updateData.title = normalizeText(payload.title);

    if (!updateData.title) {
      throw new BadRequestError("Title is required.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "response")) {
    updateData.response = normalizeText(payload.response);

    if (!updateData.response) {
      throw new BadRequestError("Response is required.");
    }
  }

  return updateData;
};

const mapLegacyQuickMessage = (quickMessage = {}) => {
  const mappedTitle = normalizeText(quickMessage.title || quickMessage.question);
  const mappedResponse = normalizeText(quickMessage.response || quickMessage.answer);

  return {
    ...quickMessage,
    title: mappedTitle,
    response: mappedResponse,
  };
};

const getQuickMessagesByQuery = async (payload = {}) => {
  try {
    const { databaseName, page, limit } = payload;
    ensureDatabaseName(databaseName);

    const { QuickMessages } = getTenantConnection(databaseName);
    const query = {};

    const parsedPage = parsePositiveInteger(page, "page");
    const parsedLimit = parsePositiveInteger(limit, "limit");

    const hasPagination = Boolean(parsedPage || parsedLimit);

    if (!hasPagination) {
      const quickMessages = await QuickMessages.find(query).sort({ createdAt: -1 }).lean();
      const mappedQuickMessages = quickMessages.map(mapLegacyQuickMessage);

      return {
        quickMessages: mappedQuickMessages,
        totalCount: mappedQuickMessages.length,
        page: 1,
        limit: mappedQuickMessages.length,
        totalPages: mappedQuickMessages.length > 0 ? 1 : 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const effectivePage = parsedPage || 1;
    const effectiveLimit = parsedLimit || 10;
    const skip = (effectivePage - 1) * effectiveLimit;

    const [quickMessages, totalCount] = await Promise.all([
      QuickMessages.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(effectiveLimit)
        .lean(),
      QuickMessages.countDocuments(query),
    ]);

    const mappedQuickMessages = quickMessages.map(mapLegacyQuickMessage);

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / effectiveLimit) : 0;

    return {
      quickMessages: mappedQuickMessages,
      totalCount,
      page: effectivePage,
      limit: effectiveLimit,
      totalPages,
      hasNextPage: totalPages > 0 && effectivePage < totalPages,
      hasPreviousPage: effectivePage > 1,
    };
  } catch (error) {
    logger.error(`Error fetching quick messages: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch quick messages: ${error.message}`);
  }
};

const createQuickMessage = async (payload = {}) => {
  try {
    const { databaseName } = payload;
    ensureDatabaseName(databaseName);

    const title = normalizeText(payload.title);
    const response = normalizeText(payload.response);

    if (!title) {
      throw new BadRequestError("Title is required.");
    }

    if (!response) {
      throw new BadRequestError("Response is required.");
    }

    const { QuickMessages } = getTenantConnection(databaseName);

    const [quickMessage] = await QuickMessages.create([
      {
        title,
        response,
      },
    ]);

    return quickMessage;
  } catch (error) {
    logger.error(`Error creating quick message: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create quick message: ${error.message}`);
  }
};

const getQuickMessageById = async (payload = {}) => {
  try {
    const { databaseName, quickMessageId } = payload;
    ensureDatabaseName(databaseName);
    ensureQuickMessageId(quickMessageId);

    const { QuickMessages } = getTenantConnection(databaseName);
    const quickMessage = await QuickMessages.findById(quickMessageId).lean();

    if (!quickMessage) {
      throw new NotFoundError("Quick message not found.");
    }

    return mapLegacyQuickMessage(quickMessage);
  } catch (error) {
    logger.error(`Error fetching quick message by id: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid quick message id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch quick message: ${error.message}`);
  }
};

const updateQuickMessageById = async (payload = {}) => {
  try {
    const { databaseName, quickMessageId, updateData: rawUpdateData } = payload;
    ensureDatabaseName(databaseName);
    ensureQuickMessageId(quickMessageId);

    const updateData = buildUpdatePayload(rawUpdateData || {});

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("At least one field is required to update quick message.");
    }

    const { QuickMessages } = getTenantConnection(databaseName);
    const quickMessage = await QuickMessages.findByIdAndUpdate(quickMessageId, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!quickMessage) {
      throw new NotFoundError("Quick message not found.");
    }

    return mapLegacyQuickMessage(quickMessage);
  } catch (error) {
    logger.error(`Error updating quick message: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid quick message id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update quick message: ${error.message}`);
  }
};

const deleteQuickMessageById = async (payload = {}) => {
  try {
    const { databaseName, quickMessageId } = payload;
    ensureDatabaseName(databaseName);
    ensureQuickMessageId(quickMessageId);

    const { QuickMessages } = getTenantConnection(databaseName);
    const deletedQuickMessage = await QuickMessages.findByIdAndDelete(quickMessageId).lean();

    if (!deletedQuickMessage) {
      throw new NotFoundError("Quick message not found.");
    }

    return mapLegacyQuickMessage(deletedQuickMessage);
  } catch (error) {
    logger.error(`Error deleting quick message: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid quick message id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to delete quick message: ${error.message}`);
  }
};

export default {
  getQuickMessagesByQuery,
  createQuickMessage,
  getQuickMessageById,
  updateQuickMessageById,
  deleteQuickMessageById,
};