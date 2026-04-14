import { param, query, validationResult } from "express-validator";
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

  const error = new AppError("Validation failed for live chat request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const getVisitorsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("search")
    .optional({ nullable: true })
    .customSanitizer(sanitizeTextInput)
    .isLength({ min: 0, max: 120 })
    .withMessage("search must be 120 characters or less"),
  validationHandler,
];

const getVisitorByIdValidator = [
  param("id")
    .customSanitizer(sanitizeTextInput)
    .isMongoId()
    .withMessage("id must be a valid visitor id"),
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
  getVisitorsValidator,
  getVisitorByIdValidator,
};
