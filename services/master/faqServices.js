import { getMasterConnection } from "../../config/masterDB.js";
import {
  AppError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const normalizeFaqText = (value) => String(value || "").trim();

const ensureFaqId = (faqId) => {
  if (!faqId || typeof faqId !== "string") {
    throw new BadRequestError("FAQ id is required.");
  }
};

const buildUpdatePayload = (payload = {}) => {
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(payload, "question")) {
    updateData.question = normalizeFaqText(payload.question);

    if (!updateData.question) {
      throw new BadRequestError("Question is required.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "answer")) {
    updateData.answer = normalizeFaqText(payload.answer);

    if (!updateData.answer) {
      throw new BadRequestError("Answer is required.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "order")) {
    const parsedOrder = Number(payload.order);

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      throw new BadRequestError("Order must be a non-negative integer.");
    }

    updateData.order = parsedOrder;
  }

  return updateData;
};

const getFAQsByQuery = async () => {
  try {
    const { FAQs } = getMasterConnection();
    return await FAQs.find({}).sort({ order: 1, createdAt: 1 }).lean();
  } catch (error) {
    logger.error(`Error fetching FAQs: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch FAQs: ${error.message}`);
  }
};

const createFAQ = async (payload) => {
  try {
    const { FAQs } = getMasterConnection();

    const question = normalizeFaqText(payload?.question);
    const answer = normalizeFaqText(payload?.answer);

    if (!question) {
      throw new BadRequestError("Question is required.");
    }

    if (!answer) {
      throw new BadRequestError("Answer is required.");
    }

    const requestedOrder = Number(payload?.order);
    const count = await FAQs.countDocuments({});

    const order = Number.isInteger(requestedOrder) && requestedOrder >= 0
      ? requestedOrder
      : count;

    const [faq] = await FAQs.create([{ question, answer, order }]);
    return faq;
  } catch (error) {
    logger.error(`Error creating FAQ: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create FAQ: ${error.message}`);
  }
};

const getFAQById = async (faqId) => {
  try {
    ensureFaqId(faqId);

    const { FAQs } = getMasterConnection();
    const faq = await FAQs.findById(faqId).lean();

    if (!faq) {
      throw new NotFoundError("FAQ not found.");
    }

    return faq;
  } catch (error) {
    logger.error(`Error fetching FAQ by id: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid FAQ id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch FAQ: ${error.message}`);
  }
};

const updateFAQById = async (faqId, payload) => {
  try {
    ensureFaqId(faqId);

    const updateData = buildUpdatePayload(payload);

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("At least one field is required to update FAQ.");
    }

    const { FAQs } = getMasterConnection();
    const faq = await FAQs.findByIdAndUpdate(faqId, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!faq) {
      throw new NotFoundError("FAQ not found.");
    }

    return faq;
  } catch (error) {
    logger.error(`Error updating FAQ: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid FAQ id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update FAQ: ${error.message}`);
  }
};

const deleteFAQById = async (faqId) => {
  try {
    ensureFaqId(faqId);

    const { FAQs } = getMasterConnection();
    const deletedFAQ = await FAQs.findByIdAndDelete(faqId).lean();

    if (!deletedFAQ) {
      throw new NotFoundError("FAQ not found.");
    }

    const remainingFaqs = await FAQs.find({}).sort({ order: 1, createdAt: 1 }).select("_id").lean();

    if (remainingFaqs.length > 0) {
      await FAQs.bulkWrite(
        remainingFaqs.map((faq, index) => ({
          updateOne: {
            filter: { _id: faq._id },
            update: { $set: { order: index } },
          },
        }))
      );
    }

    return deletedFAQ;
  } catch (error) {
    logger.error(`Error deleting FAQ: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid FAQ id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to delete FAQ: ${error.message}`);
  }
};

const reorderFAQs = async (ids = []) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError("ids must be a non-empty array.");
    }

    const normalizedIds = ids.map((id) => String(id || "").trim());

    if (normalizedIds.some((id) => !id)) {
      throw new BadRequestError("Each FAQ id in ids must be a non-empty string.");
    }

    const { FAQs } = getMasterConnection();

    const existingFAQs = await FAQs.find({ _id: { $in: normalizedIds } }).select("_id").lean();

    if (existingFAQs.length !== normalizedIds.length) {
      throw new BadRequestError("One or more FAQ ids are invalid.");
    }

    await FAQs.bulkWrite(
      normalizedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: index } },
        },
      }))
    );

    return await FAQs.find({}).sort({ order: 1, createdAt: 1 }).lean();
  } catch (error) {
    logger.error(`Error reordering FAQs: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid FAQ id provided for reorder.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to reorder FAQs: ${error.message}`);
  }
};

export default {
  getFAQsByQuery,
  createFAQ,
  getFAQById,
  updateFAQById,
  deleteFAQById,
  reorderFAQs,
};
