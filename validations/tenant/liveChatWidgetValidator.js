import { body, param, query, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const sanitizeTextInput = (value) => String(value ?? "")
  .replace(/[\u0000-\u001F\u007F]/g, "")
  .replace(/[<>]/g, "")
  .trim();

const validationHandler = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError("Validation failed for live chat widget request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const startWidgetConversationValidator = [
  body("visitorToken")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 2, max: 128 })
    .withMessage("visitorToken must be between 2 and 128 characters"),
  body("name")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 120 })
    .withMessage("name must be between 1 and 120 characters"),
  body("emailAddress")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isEmail()
    .withMessage("emailAddress must be a valid email"),
  body("message")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 2000 })
    .withMessage("message must be between 1 and 2000 characters"),
  validationHandler,
];

const sendWidgetMessageValidator = [
  body("conversationId")
    .customSanitizer(sanitizeTextInput)
    .isMongoId()
    .withMessage("conversationId must be a valid id"),
  body("visitorToken")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 2, max: 128 })
    .withMessage("visitorToken must be between 2 and 128 characters"),
  body("message")
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 2000 })
    .withMessage("message must be between 1 and 2000 characters"),
  validationHandler,
];

const getWidgetMessagesValidator = [
  param("conversationId")
    .customSanitizer(sanitizeTextInput)
    .isMongoId()
    .withMessage("conversationId must be a valid id"),
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  validationHandler,
];

export {
  startWidgetConversationValidator,
  sendWidgetMessageValidator,
  getWidgetMessagesValidator,
};
