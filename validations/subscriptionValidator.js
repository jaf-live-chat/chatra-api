import { body, validationResult } from 'express-validator';

const subscribeToPlanValidator = [
  body('subscriptionData.companyName')
    .trim()
    .notEmpty()
    .withMessage('companyName is required'),
  body('subscriptionData.subscriptionPlan')
    .trim()
    .notEmpty()
    .withMessage('subscriptionPlan is required'),
  body('subscriptionData.subscriptionStart')
    .notEmpty()
    .withMessage('subscriptionStart is required')
    .bail()
    .isISO8601()
    .withMessage('subscriptionStart must be a valid ISO 8601 date'),
  body('subscriptionData.subscriptionEnd')
    .notEmpty()
    .withMessage('subscriptionEnd is required')
    .bail()
    .isISO8601()
    .withMessage('subscriptionEnd must be a valid ISO 8601 date'),
  body('agentData.fullName')
    .trim()
    .notEmpty()
    .withMessage('fullName is required'),
  body('agentData.emailAddress')
    .trim()
    .notEmpty()
    .withMessage('emailAddress is required')
    .bail()
    .isEmail()
    .withMessage('emailAddress must be a valid email address')
    .normalizeEmail(),
  body('agentData.password')
    .isString()
    .withMessage('password is required')
    .bail()
    .notEmpty()
    .withMessage('password is required'),
  body('subscriptionData').custom((subscriptionData = {}) => {
    const { subscriptionStart, subscriptionEnd } = subscriptionData;

    if (!subscriptionStart || !subscriptionEnd) {
      return true;
    }

    const startDate = new Date(subscriptionStart);
    const endDate = new Date(subscriptionEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return true;
    }

    if (endDate < startDate) {
      throw new Error('subscriptionEnd must be on or after subscriptionStart');
    }

    return true;
  }),
  (req, _res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const error = new Error('Validation failed for subscription request');
    error.name = 'RequestValidationError';
    error.statusCode = 422;
    error.errors = errors.array({ onlyFirstError: true });

    return next(error);
  },
];

export {
  subscribeToPlanValidator,
};
