import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

const validationHandler = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError("Validation failed for widget settings request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const updateWidgetSettingsValidator = [
  body("widgetLogo")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("widgetLogo must be at most 2000 characters"),
  body("widgetTitle")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("widgetTitle cannot be empty")
    .bail()
    .isLength({ min: 1, max: 120 })
    .withMessage("widgetTitle must be between 1 and 120 characters"),
  body("welcomeMessage")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("welcomeMessage cannot be empty")
    .bail()
    .isLength({ min: 1, max: 2000 })
    .withMessage("welcomeMessage must be between 1 and 2000 characters"),
  body("accentColor")
    .optional()
    .trim()
    .custom((value) => HEX_COLOR_REGEX.test(value))
    .withMessage("accentColor must be a valid hex color"),
  validationHandler,
];

export {
  updateWidgetSettingsValidator,
};
