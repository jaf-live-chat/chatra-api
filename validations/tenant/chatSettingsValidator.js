import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const validationHandler = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError("Validation failed for chat settings request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const updateQueueAssignmentModeValidator = [
  body("assignmentMode")
    .trim()
    .notEmpty()
    .withMessage("assignmentMode is required")
    .bail()
    .isIn(["MANUAL", "ROUND_ROBIN"])
    .withMessage("assignmentMode must be either MANUAL or ROUND_ROBIN"),
  validationHandler,
];

export {
  updateQueueAssignmentModeValidator,
};
