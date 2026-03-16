import { body, validationResult } from "express-validator";
import { AppError } from "../utils/errors.js";

const loginValidator = [
  body("companyCode")
    .trim()
    .notEmpty()
    .withMessage("companyCode is required")
    .bail()
    .isLength({ min: 3, max: 5 })
    .withMessage("companyCode must be between 3 and 5 characters")
    .bail()
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage("companyCode must be alphanumeric"),
  body("emailAddress")
    .trim()
    .notEmpty()
    .withMessage("emailAddress is required")
    .bail()
    .isEmail()
    .withMessage("emailAddress must be a valid email address")
    .normalizeEmail(),
  body("password")
    .isString()
    .withMessage("password is required")
    .bail()
    .notEmpty()
    .withMessage("password is required"),
  (req, _res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const error = new AppError("Validation failed for login request", 422);
    error.name = "RequestValidationError";
    error.errors = errors.array({ onlyFirstError: true });

    return next(error);
  },
];

export {
  loginValidator,
};
