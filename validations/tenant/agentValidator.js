import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";
import { USER_ROLES } from "../../constants/constants.js";

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

const createAgentValidator = [
  body("agents")
    .isArray({ min: 1 })
    .withMessage("agents must be a non-empty array"),
  body("agents.*.fullName")
    .trim()
    .notEmpty()
    .withMessage("Each agent must have a fullName"),
  body("agents.*.emailAddress")
    .trim()
    .notEmpty()
    .withMessage("Each agent must have an emailAddress")
    .bail()
    .isEmail()
    .withMessage("Each agent emailAddress must be a valid email")
    .normalizeEmail(),
  body("agents.*.password")
    .isString()
    .withMessage("Each agent must have a password")
    .bail()
    .notEmpty()
    .withMessage("Each agent password cannot be empty")
    .bail()
    .isLength({ min: 8 })
    .withMessage("Each agent password must be at least 8 characters"),
  body("agents.*.role")
    .trim()
    .notEmpty()
    .withMessage("Each agent must have a role")
    .bail()
    .isIn(Object.values(USER_ROLES).map((r) => r.value))
    .withMessage(
      `Each agent role must be one of: ${Object.values(USER_ROLES)
        .map((r) => r.value)
        .join(", ")}`
    ),
  body("agents.*.phoneNumber")
    .optional({ nullable: true })
    .isString()
    .withMessage("phoneNumber must be a string"),
  body("agents.*.profilePicture")
    .optional({ nullable: true })
    .isString()
    .withMessage("profilePicture must be a string"),
  (req, _res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const error = new AppError("Validation failed for create agent request", 422);
    error.name = "RequestValidationError";
    error.errors = errors.array({ onlyFirstError: true });

    return next(error);
  },
];

export {
  loginValidator,
  createAgentValidator,
};
