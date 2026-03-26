import multer from 'multer';
import { CloudinaryError } from '../utils/errors.js';
import { ALLOWED_FILE_TYPES } from '../utils/fileUploadService.js';

/**
 * Configure multer to use memory storage
 * Files will be stored in memory as Buffer objects
 */
const storage = multer.memoryStorage();

/**
 * File filter function to validate file types
 * @param {Object} req - Express request object
 * @param {Object} file - File object from multer
 * @param {Function} cb - Callback function
 * @param {string} fileCategory - Category of file to validate against
 */
const createFileFilter = (fileCategory = 'IMAGES') => {
  return (req, file, cb) => {
    const allowedTypes = ALLOWED_FILE_TYPES[fileCategory];

    if (!allowedTypes) {
      return cb(
        new CloudinaryError(`Invalid file category: ${fileCategory}`),
        false
      );
    }

    if (allowedTypes.mimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new CloudinaryError(
          `Invalid file type. Allowed types: ${allowedTypes.extensions.join(', ')}`
        ),
        false
      );
    }
  };
};

/**
 * Create multer upload middleware with size limits
 * @param {Object} options - Configuration options
 * @param {string} options.fileCategory - Category of file (IMAGES, DOCUMENTS, etc.)
 * @param {number} options.maxSize - Maximum file size in bytes (overrides category default)
 * @returns {Object} - Multer middleware
 */
const createUploadMiddleware = (options = {}) => {
  const { fileCategory = 'IMAGES', maxSize } = options;
  const allowedTypes = ALLOWED_FILE_TYPES[fileCategory];

  if (!allowedTypes) {
    throw new Error(`Invalid file category: ${fileCategory}`);
  }

  const limits = {
    fileSize: maxSize || allowedTypes.maxSize,
  };

  return multer({
    storage,
    fileFilter: createFileFilter(fileCategory),
    limits,
  });
};

/**
 * Middleware to handle single file upload
 * Usage: uploadSingle('fieldName', { fileCategory: 'IMAGES' })
 */
export const uploadSingle = (fieldName, options = {}) => {
  const upload = createUploadMiddleware(options);
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const allowedTypes = ALLOWED_FILE_TYPES[options.fileCategory || 'IMAGES'];
          const maxSizeMB = (allowedTypes.maxSize / (1024 * 1024)).toFixed(2);
          return next(
            new CloudinaryError(`File size exceeds maximum allowed size of ${maxSizeMB}MB`)
          );
        }
        return next(new CloudinaryError(`File upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

/**
 * Middleware to handle multiple files upload
 * Usage: uploadMultiple('fieldName', 5, { fileCategory: 'IMAGES' })
 */
export const uploadMultiple = (fieldName, maxCount = 10, options = {}) => {
  const upload = createUploadMiddleware(options);
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const allowedTypes = ALLOWED_FILE_TYPES[options.fileCategory || 'IMAGES'];
          const maxSizeMB = (allowedTypes.maxSize / (1024 * 1024)).toFixed(2);
          return next(
            new CloudinaryError(`File size exceeds maximum allowed size of ${maxSizeMB}MB`)
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new CloudinaryError(`Too many files. Maximum allowed: ${maxCount}`)
          );
        }
        return next(new CloudinaryError(`File upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

/**
 * Middleware to handle multiple fields with files
 * Usage: uploadFields([
 *   { name: 'avatar', maxCount: 1 },
 *   { name: 'gallery', maxCount: 5 }
 * ], { fileCategory: 'IMAGES' })
 */
export const uploadFields = (fields, options = {}) => {
  const upload = createUploadMiddleware(options);
  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const allowedTypes = ALLOWED_FILE_TYPES[options.fileCategory || 'IMAGES'];
          const maxSizeMB = (allowedTypes.maxSize / (1024 * 1024)).toFixed(2);
          return next(
            new CloudinaryError(`File size exceeds maximum allowed size of ${maxSizeMB}MB`)
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new CloudinaryError('Unexpected field in form data'));
        }
        return next(new CloudinaryError(`File upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

/**
 * Predefined middleware for common use cases
 */

// Upload single image (photos)
export const uploadPhoto = uploadSingle('photo', { fileCategory: 'IMAGES' });

// Upload multiple photos (up to 10)
export const uploadPhotos = uploadMultiple('photos', 10, { fileCategory: 'IMAGES' });

// Upload single document
export const uploadDocument = uploadSingle('document', { fileCategory: 'DOCUMENTS' });

// Upload multiple documents (up to 5)
export const uploadDocuments = uploadMultiple('documents', 5, { fileCategory: 'DOCUMENTS' });

export default {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadPhoto,
  uploadPhotos,
  uploadDocument,
  uploadDocuments,
};
