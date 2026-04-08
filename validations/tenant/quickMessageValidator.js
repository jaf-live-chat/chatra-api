import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const validationHandler = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError("Validation failed for quick message request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const createQuickMessageValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("title is required")
    .bail()
    .isLength({ min: 1, max: 500 })
    .withMessage("title must be between 1 and 500 characters"),
  body("response")
    .trim()
    .notEmpty()
    .withMessage("response is required")
    .bail()
    .isLength({ min: 1, max: 2000 })
    .withMessage("response must be between 1 and 2000 characters"),
  validationHandler,
];

const updateQuickMessageValidator = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("title cannot be empty")
    .bail()
    .isLength({ min: 1, max: 500 })
    .withMessage("title must be between 1 and 500 characters"),
  body("response")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("response cannot be empty")
    .bail()
    .isLength({ min: 1, max: 2000 })
    .withMessage("response must be between 1 and 2000 characters"),
  validationHandler,
];

export {
  createQuickMessageValidator,
  updateQuickMessageValidator,
};