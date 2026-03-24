import { getMasterConnection } from "../../config/masterDB.js";
import { getSubscriptionPlanModel } from "../../models/master/SubscriptionPlans.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const normalizeName = (name = "") => String(name).trim();

const ensureValidPlanId = (planId) => {
  if (!planId || typeof planId !== "string") {
    throw new BadRequestError("subscription plan id is required");
  }
};

const createSubscriptionPlan = async (payload) => {
  try {
    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    const {
      name,
      description,
      price,
      billingCycle,
      interval,
      limits,
      features,
      isPosted,
    } = payload || {};

    const normalizedName = normalizeName(name);
    const existingPlan = await SubscriptionPlan.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" },
    }).lean();

    if (existingPlan) {
      throw new ConflictError(`Subscription plan \"${normalizedName}\" already exists.`);
    }

    const [newPlan] = await SubscriptionPlan.create([
      {
        name: normalizedName,
        description,
        price,
        billingCycle,
        interval,
        limits,
        features,
        isPosted,
      },
    ]);

    return newPlan;
  } catch (error) {
    logger.error(`Error creating subscription plan: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create subscription plan: ${error.message}`);
  }
};

const getSubscriptionPlansByQuery = async (query = {}) => {
  try {
    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    const filter = {};

    if (query.name) {
      filter.name = { $regex: String(query.name).trim(), $options: "i" };
    }

    if (query.isPosted !== undefined) {
      filter.isPosted = String(query.isPosted).toLowerCase() === "true";
    }

    const plans = await SubscriptionPlan.find(filter).sort({ createdAt: -1 });
    return plans;
  } catch (error) {
    logger.error(`Error fetching subscription plans: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch subscription plans: ${error.message}`);
  }
};

const getSubscriptionPlanById = async (planId) => {
  try {
    ensureValidPlanId(planId);

    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      throw new NotFoundError("Subscription plan not found.");
    }

    return plan;
  } catch (error) {
    logger.error(`Error fetching subscription plan by id: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid subscription plan id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch subscription plan: ${error.message}`);
  }
};

const updateSubscriptionPlanById = async (planId, payload) => {
  try {
    ensureValidPlanId(planId);

    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    const updateData = { ...payload };
    if (Object.prototype.hasOwnProperty.call(updateData, "name")) {
      updateData.name = normalizeName(updateData.name);
    }

    if (updateData.name) {
      const existingPlan = await SubscriptionPlan.findOne({
        _id: { $ne: planId },
        name: { $regex: `^${updateData.name}$`, $options: "i" },
      }).lean();

      if (existingPlan) {
        throw new ConflictError(`Subscription plan \"${updateData.name}\" already exists.`);
      }
    }

    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(planId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedPlan) {
      throw new NotFoundError("Subscription plan not found.");
    }

    return updatedPlan;
  } catch (error) {
    logger.error(`Error updating subscription plan: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid subscription plan id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update subscription plan: ${error.message}`);
  }
};

const deleteSubscriptionPlanById = async (planId) => {
  try {
    ensureValidPlanId(planId);

    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    const deletedPlan = await SubscriptionPlan.findByIdAndDelete(planId);

    if (!deletedPlan) {
      throw new NotFoundError("Subscription plan not found.");
    }

    return deletedPlan;
  } catch (error) {
    logger.error(`Error deleting subscription plan: ${error.message}`);

    if (error.name === "CastError") {
      throw new BadRequestError("Invalid subscription plan id.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to delete subscription plan: ${error.message}`);
  }
};

export default {
  createSubscriptionPlan,
  getSubscriptionPlansByQuery,
  getSubscriptionPlanById,
  updateSubscriptionPlanById,
  deleteSubscriptionPlanById,
};
