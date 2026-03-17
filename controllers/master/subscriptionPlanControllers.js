import expressAsyncHandler from "express-async-handler";
import { logger } from "../../utils/logger.js";
import subscriptionPlanServices from "../../services/master/subscriptionPlanServices.js";

const createSubscriptionPlan = expressAsyncHandler(async (req, res) => {
  try {
    const plan = await subscriptionPlanServices.createSubscriptionPlan(req.body);

    res.status(201).json({
      success: true,
      message: "Subscription plan created successfully.",
      plan,
    });
  } catch (error) {
    logger.error(`Error creating subscription plan: ${error.message}`);
    throw error;
  }
});

const getSubscriptionPlansByQuery = expressAsyncHandler(async (req, res) => {
  try {
    const plans = await subscriptionPlanServices.getSubscriptionPlansByQuery(req.query);

    res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    logger.error(`Error fetching subscription plans: ${error.message}`);
    throw error;
  }
});

const getSubscriptionPlanById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await subscriptionPlanServices.getSubscriptionPlanById(id);

    res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    logger.error(`Error fetching subscription plan by id: ${error.message}`);
    throw error;
  }
});

const updateSubscriptionPlanById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await subscriptionPlanServices.updateSubscriptionPlanById(id, req.body);

    res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully.",
      plan,
    });
  } catch (error) {
    logger.error(`Error updating subscription plan: ${error.message}`);
    throw error;
  }
});

const deleteSubscriptionPlanById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    await subscriptionPlanServices.deleteSubscriptionPlanById(id);

    res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully.",
    });
  } catch (error) {
    logger.error(`Error deleting subscription plan: ${error.message}`);
    throw error;
  }
});

export {
  createSubscriptionPlan,
  getSubscriptionPlansByQuery,
  getSubscriptionPlanById,
  updateSubscriptionPlanById,
  deleteSubscriptionPlanById,
};
