import {
  createSubscriptionPlan,
  deleteSubscriptionPlanById,
  getSubscriptionPlanById,
  getSubscriptionPlansByQuery,
  updateSubscriptionPlanById,
} from "../../controllers/master/subscriptionPlanControllers.js";
import {
  createSubscriptionPlanValidator,
  updateSubscriptionPlanValidator,
  validateSubscriptionPlanId,
} from "../../validations/master/subscriptionPlanValidator.js";
import { masterAdminAuth, protect } from "../../middlewares/authMiddleware.js";

import express from "express";

const router = express.Router();

router.post("/", createSubscriptionPlanValidator, protect, masterAdminAuth, createSubscriptionPlan);
router.get("/", getSubscriptionPlansByQuery);
router.get("/:id", validateSubscriptionPlanId, getSubscriptionPlanById);
router.put("/:id", validateSubscriptionPlanId, updateSubscriptionPlanValidator, protect, masterAdminAuth, updateSubscriptionPlanById);
router.delete("/:id", validateSubscriptionPlanId, protect, masterAdminAuth, deleteSubscriptionPlanById);

export default router;
