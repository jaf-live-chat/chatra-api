import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';

const STATUS_MESSAGES = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Unprocessable entity',
  429: 'Too many requests',
  500: 'Internal server error',
};

const notFound = (req, res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
};

const getStatusCode = (err, res) => {
  if (res.statusCode && res.statusCode >= 400) {
    return res.statusCode;
  }

  if (err.statusCode && Number.isInteger(err.statusCode)) {
    return err.statusCode;
  }

  if (err.status && Number.isInteger(err.status)) {
    return err.status;
  }

  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return 400;
  }

  if (err.code === 11000) {
    return 409;
  }

  return 500;
};

const extractValidationDetails = (err) => {
  if (Array.isArray(err.errors)) {
    return err.errors
      .map((validationError) => validationError?.msg)
      .filter(Boolean);
  }

  if (!err.errors || typeof err.errors !== 'object') {
    return null;
  }

  return Object.values(err.errors)
    .map((validationError) => validationError?.message)
    .filter(Boolean);
};

const buildClientMessage = (err, statusCode, isProduction) => {
  if (err.name === 'RequestValidationError') {
    return 'Validation failed. Please check your input and try again.';
  }

  if (err.name === 'ValidationError') {
    return 'Validation failed. Please check your input and try again.';
  }

  if (err.name === 'CastError') {
    return `Invalid value provided for ${err.path || 'a field'}.`;
  }

  if (err.code === 11000) {
    return 'A record with the same unique value already exists.';
  }

  if (statusCode >= 500 && isProduction) {
    return STATUS_MESSAGES[500];
  }

  return err.message || STATUS_MESSAGES[statusCode] || STATUS_MESSAGES[500];
};

const errorHandler = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = getStatusCode(err, res);
  const message = buildClientMessage(err, statusCode, isProduction);
  const validationDetails = extractValidationDetails(err);

  res.status(statusCode);

  logger.error(
    [
      `Request failed: ${req.method} ${req.originalUrl}`,
      `status=${statusCode}`,
      `message=${err.message || 'Unknown error'}`,
      err.stack ? `stack=${err.stack}` : null,
    ]
      .filter(Boolean)
      .join(' | ')
  );

  const responseBody = {
    success: false,
    message,
  };

  if (validationDetails?.length) {
    responseBody.errors = validationDetails;
  }

  if (!isProduction) {
    responseBody.debug = {
      type: err.name || 'Error',
      originalMessage: err.message,
      stack: err.stack,
    };
  }

  res.json(responseBody);
};

export { notFound, errorHandler };
