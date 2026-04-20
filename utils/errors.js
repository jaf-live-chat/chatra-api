class AppError extends Error {
  constructor(message, statusCode, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', options = {}) {
    super(message, 400, options);
    this.name = 'BadRequestError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options = {}) {
    super(message, 401, options);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', options = {}) {
    super(message, 403, options);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found', options = {}) {
    super(message, 404, options);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', options = {}) {
    super(message, 409, options);
    this.name = 'ConflictError';
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', options = {}) {
    super(message, 500, options);
    this.name = 'InternalServerError';
  }
}

class CloudinaryError extends AppError {
  constructor(message = 'File upload failed', options = {}) {
    super(message, 400, options);
    this.name = 'CloudinaryError';
  }
}

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  CloudinaryError
}