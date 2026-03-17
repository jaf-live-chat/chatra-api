import { body, param, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const buildValidationError = (req, next, message) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError(message, 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const validateSubscriptionPlanId = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("subscription plan id is required")
    .bail()
    .isMongoId()
    .withMessage("subscription plan id must be a valid MongoDB ObjectId"),
  (req, _res, next) => buildValidationError(req, next, "Validation failed for subscription plan id."),
];

const createSubscriptionPlanValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name is required"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("description is required"),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .bail()
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
  body("trialDays")
    .optional()
    .isInt({ min: 0 })
    .withMessage("trialDays must be a non-negative integer"),

  body("limits").optional().isObject().withMessage("limits must be an object"),
  body("limits.maxAgents").optional().isInt({ min: 1 }).withMessage("limits.maxAgents must be at least 1"),
  body("limits.maxWebsites").optional().isInt({ min: 1 }).withMessage("limits.maxWebsites must be at least 1"),

  body("features").optional().isObject().withMessage("features must be an object"),
  body("features.analytics").optional().isBoolean().withMessage("features.analytics must be a boolean"),
  body("features.fileSharing").optional().isBoolean().withMessage("features.fileSharing must be a boolean"),
  body("features.visitorTracking").optional().isBoolean().withMessage("features.visitorTracking must be a boolean"),
  body("features.prioritySupport").optional().isBoolean().withMessage("features.prioritySupport must be a boolean"),
  body("isPosted").optional().isBoolean().withMessage("isPosted must be a boolean"),
  (req, _res, next) => buildValidationError(req, next, "Validation failed for create subscription plan request."),
];

const updateSubscriptionPlanValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("name cannot be empty"),
  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("description cannot be empty"),
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("price must be a non-negative number"),
  body("trialDays")
    .optional()
    .isInt({ min: 0 })
    .withMessage("trialDays must be a non-negative integer"),

  body("limits").optional().isObject().withMessage("limits must be an object"),
  body("limits.maxAgents").optional().isInt({ min: 1 }).withMessage("limits.maxAgents must be at least 1"),
  body("limits.maxWebsites").optional().isInt({ min: 1 }).withMessage("limits.maxWebsites must be at least 1"),

  body("features").optional().isObject().withMessage("features must be an object"),
  body("features.analytics").optional().isBoolean().withMessage("features.analytics must be a boolean"),
  body("features.fileSharing").optional().isBoolean().withMessage("features.fileSharing must be a boolean"),
  body("features.visitorTracking").optional().isBoolean().withMessage("features.visitorTracking must be a boolean"),
  body("features.prioritySupport").optional().isBoolean().withMessage("features.prioritySupport must be a boolean"),
  body("isPosted").optional().isBoolean().withMessage("isPosted must be a boolean"),
  body().custom((value = {}) => {
    if (!value || Object.keys(value).length === 0) {
      throw new Error("At least one field must be provided to update the subscription plan");
    }

    return true;
  }),
  (req, _res, next) => buildValidationError(req, next, "Validation failed for update subscription plan request."),
];

export {
  validateSubscriptionPlanId,
  createSubscriptionPlanValidator,
  updateSubscriptionPlanValidator,
};
