import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

const normalizeWebsiteWithProtocol = (value) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
};

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeOptionalWebsite = (value) => {
  const normalized = normalizeWebsiteWithProtocol(value);

  if (!normalized) {
    return "";
  }

  return isValidHttpUrl(normalized) ? normalized : "";
};

const normalizeOptionalEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  return isValidEmailAddress(normalized) ? normalized : "";
};

const validationHandler = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new AppError("Validation failed for company info request", 422);
  error.name = "RequestValidationError";
  error.errors = errors.array({ onlyFirstError: true });

  return next(error);
};

const updateCompanyInfoValidator = [
  body("generalInformation.companyName")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("generalInformation.companyName cannot exceed 200 characters"),
  body("generalInformation.contactEmail")
    .optional()
    .customSanitizer(normalizeOptionalEmail),
  body("generalInformation.phoneNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("generalInformation.phoneNumber cannot exceed 100 characters"),
  body("generalInformation.socialLinks.facebook")
    .optional()
    .customSanitizer(normalizeOptionalWebsite),
  body("generalInformation.socialLinks.instagram")
    .optional()
    .customSanitizer(normalizeOptionalWebsite),
  body("generalInformation.socialLinks.website")
    .optional()
    .customSanitizer(normalizeOptionalWebsite),
  body().custom((value) => {
    const payload = value && typeof value === "object" ? value : {};

    const hasGeneralInformation = payload.generalInformation && Object.keys(payload.generalInformation).length > 0;

    if (!hasGeneralInformation) {
      throw new Error("generalInformation section is required.");
    }

    return true;
  }),
  validationHandler,
];

export {
  updateCompanyInfoValidator,
};
