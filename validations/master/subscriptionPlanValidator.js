import { body, param, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const BILLING_CYCLE_VALUES = ["daily", "weekly", "monthly", "yearly"];

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
  body("billingCycle")
    .trim()
    .notEmpty()
    .withMessage("billingCycle is required")
    .bail()
    .isIn(BILLING_CYCLE_VALUES)
    .withMessage(`billingCycle must be one of: ${BILLING_CYCLE_VALUES.join(", ")}`),
  body("interval")
    .optional()
    .isInt({ min: 1 })
    .withMessage("interval must be an integer greater than or equal to 1"),

  body("limits").optional().isObject().withMessage("limits must be an object"),
  body("limits.maxAgents").optional().isInt({ min: 1 }).withMessage("limits.maxAgents must be at least 1"),
  body("limits.maxWebsites").optional().isInt({ min: 1 }).withMessage("limits.maxWebsites must be at least 1"),

  body("features").optional().isArray().withMessage("features must be an array of strings"),
  body("features.*").optional().isString().withMessage("each feature must be a string"),

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
  body("billingCycle")
    .optional()
    .trim()
    .isIn(BILLING_CYCLE_VALUES)
    .withMessage(`billingCycle must be one of: ${BILLING_CYCLE_VALUES.join(", ")}`),
  body("interval")
    .optional()
    .isInt({ min: 1 })
    .withMessage("interval must be an integer greater than or equal to 1"),

  body("limits").optional().isObject().withMessage("limits must be an object"),
  body("limits.maxAgents").optional().isInt({ min: 1 }).withMessage("limits.maxAgents must be at least 1"),
  body("limits.maxWebsites").optional().isInt({ min: 1 }).withMessage("limits.maxWebsites must be at least 1"),

  body("features").optional().isArray().withMessage("features must be an array of strings"),
  body("features.*").optional().isString().withMessage("each feature must be a string"),

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
