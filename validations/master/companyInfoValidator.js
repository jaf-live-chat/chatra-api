import { body, validationResult } from "express-validator";
import { AppError } from "../../utils/errors.js";

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
  body("generalInformation.website")
    .optional()
    .trim()
    .isURL({ require_protocol: true })
    .withMessage("generalInformation.website must be a valid URL with protocol"),
  body("generalInformation.contactEmail")
    .optional()
    .trim()
    .isEmail()
    .withMessage("generalInformation.contactEmail must be a valid email"),
  body("generalInformation.phoneNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("generalInformation.phoneNumber cannot exceed 100 characters"),
  body("address.streetAddress")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("address.streetAddress cannot exceed 300 characters"),
  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("address.city cannot exceed 150 characters"),
  body("address.stateProvince")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("address.stateProvince cannot exceed 150 characters"),
  body("address.zipPostalCode")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("address.zipPostalCode cannot exceed 30 characters"),
  body("address.country")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("address.country cannot exceed 150 characters"),
  body("businessDetails.industry")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("businessDetails.industry cannot exceed 150 characters"),
  body("businessDetails.companySize")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("businessDetails.companySize cannot exceed 150 characters"),
  body("businessDetails.timezone")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("businessDetails.timezone cannot exceed 150 characters"),
  body("businessDetails.description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("businessDetails.description cannot exceed 2000 characters"),
  body().custom((value) => {
    const payload = value && typeof value === "object" ? value : {};

    const hasGeneralInformation = payload.generalInformation && Object.keys(payload.generalInformation).length > 0;
    const hasAddress = payload.address && Object.keys(payload.address).length > 0;
    const hasBusinessDetails = payload.businessDetails && Object.keys(payload.businessDetails).length > 0;

    if (!hasGeneralInformation && !hasAddress && !hasBusinessDetails) {
      throw new Error("At least one company info section is required.");
    }

    return true;
  }),
  validationHandler,
];

export {
  updateCompanyInfoValidator,
};
