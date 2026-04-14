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
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 2, max: 128 })
    .withMessage("visitorToken must be between 2 and 128 characters"),
  body("fullName")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 120 })
    .withMessage("fullName must be between 1 and 120 characters"),
  body("name")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 120 })
    .withMessage("name must be between 1 and 120 characters"),
  body("emailAddress")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isEmail()
    .withMessage("emailAddress must be a valid email"),
  body("phoneNumber")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 4, max: 25 })
    .withMessage("phoneNumber must be between 4 and 25 characters"),
  body("message")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 1, max: 2000 })
    .withMessage("message must be between 1 and 2000 characters"),
  body("ipAddressConsent")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("ipAddressConsent must be a boolean"),
  body("locationConsent")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("locationConsent must be a boolean"),
  body("browserLatitude")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("browserLatitude must be a valid latitude"),
  body("browserLongitude")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("browserLongitude must be a valid longitude"),
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

const getWidgetQuickMessagesValidator = [
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

const getWidgetConversationHistoryValidator = [
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

const getWidgetVisitorProfileValidator = [
  validationHandler,
];

const updateWidgetVisitorProfileValidator = [
  body("fullName")
    .optional({ nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 0, max: 120 })
    .withMessage("fullName must be 120 characters or less"),
  body("name")
    .optional({ nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 0, max: 120 })
    .withMessage("name must be 120 characters or less"),
  body("emailAddress")
    .optional({ nullable: true })
    .customSanitizer(sanitizeTextInput)
    .custom((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .withMessage("emailAddress must be a valid email"),
  body("phoneNumber")
    .optional({ nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 0, max: 25 })
    .withMessage("phoneNumber must be 25 characters or less"),
  validationHandler,
];

const endWidgetConversationValidator = [
  param("id")
    .customSanitizer(sanitizeTextInput)
    .isMongoId()
    .withMessage("id must be a valid conversation id"),
  body("visitorToken")
    .optional()
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 2, max: 128 })
    .withMessage("visitorToken must be between 2 and 128 characters"),
  validationHandler,
];

export {
  startWidgetConversationValidator,
  sendWidgetMessageValidator,
  endWidgetConversationValidator,
  getWidgetMessagesValidator,
  getWidgetQuickMessagesValidator,
  getWidgetConversationHistoryValidator,
  getWidgetVisitorProfileValidator,
  updateWidgetVisitorProfileValidator,
};
