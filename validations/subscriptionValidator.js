import { body, validationResult } from 'express-validator';
import { PAYMENT_STATUS } from '../constants/constants.js';
import { AppError } from '../utils/errors.js';

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
  body('paymentData.amount')
    .notEmpty()
    .withMessage('payment amount is required')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('payment amount must be greater than 0'),
  body('paymentData.referenceNumber')
    .trim()
    .notEmpty()
    .withMessage('payment referenceNumber is required'),
  body('paymentData.status')
    .optional()
    .isIn(Object.values(PAYMENT_STATUS))
    .withMessage(`payment status must be one of: ${Object.values(PAYMENT_STATUS).join(', ')}`),
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

    const error = new AppError('Validation failed for subscription request', 422);
    error.name = 'RequestValidationError';
    error.errors = errors.array({ onlyFirstError: true });

    return next(error);
  },
];

export {
  subscribeToPlanValidator,
};
