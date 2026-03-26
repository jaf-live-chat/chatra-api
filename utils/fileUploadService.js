import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryError } from './errors.js';

/**
 * Configure Cloudinary (lazy initialization)
 * Called before each upload to ensure env vars are loaded
 */
const configureCloudinary = () => {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
};

/**
 * Allowed file types configuration
 * Can be extended to support more file types
 */
export const ALLOWED_FILE_TYPES = {
  IMAGES: {
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxSize: 5 * 1024 * 1024, // 5MB
    folder: 'images',
  },
  DOCUMENTS: {
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.doc', '.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
    folder: 'documents',
  },
  MEDICAL_LICENSE: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ],
    extensions: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
    maxSize: 10 * 1024 * 1024, // 10MB
    folder: 'medical-licenses',
  },
  // Add more file types as needed
};

/**
 * Validates file type against allowed types
 * @param {Object} file - The file object from multer
 * @param {string} fileCategory - Category of file (IMAGES, DOCUMENTS, etc.)
 * @returns {boolean} - Whether the file is valid
 */
export const validateFileType = (file, fileCategory = 'IMAGES') => {
  const allowedTypes = ALLOWED_FILE_TYPES[fileCategory];

  if (!allowedTypes) {
    throw new CloudinaryError(`Invalid file category: ${fileCategory}`);
  }

  const isValidMimeType = allowedTypes.mimeTypes.includes(file.mimetype);
  const isValidSize = file.size <= allowedTypes.maxSize;

  if (!isValidMimeType) {
    throw new CloudinaryError(
      `Invalid file type. Allowed types: ${allowedTypes.extensions.join(', ')}`
    );
  }

  if (!isValidSize) {
    const maxSizeMB = (allowedTypes.maxSize / (1024 * 1024)).toFixed(2);
    throw new CloudinaryError(
      `File size exceeds maximum allowed size of ${maxSizeMB}MB`
    );
  }

  return true;
};

/**
 * Upload a file to Cloudinary
 * @param {Object} file - The file buffer from multer
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder path
 * @param {string} options.fileCategory - Category of file (IMAGES, DOCUMENTS, etc.)
 * @param {string} options.resource_type - Cloudinary resource type (image, raw, video, auto)
 * @param {Object} options.transformation - Cloudinary transformation options
 * @returns {Promise<Object>} - Upload result
 */
export const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Ensure Cloudinary is configured
    configureCloudinary();

    const {
      folder = 'health-patient-network',
      fileCategory = 'IMAGES',
      resource_type = 'auto',
      transformation = {},
    } = options;

    // Validate file
    validateFileType(file, fileCategory);

    // Convert buffer to base64 data URI
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `${folder}/${ALLOWED_FILE_TYPES[fileCategory].folder}`,
      resource_type,
      transformation,
      // Generate unique filename
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new CloudinaryError(
      error.message || 'Failed to upload file to Cloudinary'
    );
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array} files - Array of file objects from multer
 * @param {Object} options - Upload options (same as uploadToCloudinary)
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadMultipleToCloudinary = async (files, options = {}) => {
  try {
    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file, options)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple files upload error:', error);
    throw new CloudinaryError(
      error.message || 'Failed to upload files to Cloudinary'
    );
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file in Cloudinary
 * @param {string} resource_type - Cloudinary resource type (image, raw, video)
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteFromCloudinary = async (publicId, resource_type = 'image') => {
  try {
    // Ensure Cloudinary is configured
    configureCloudinary();

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
    });

    if (result.result === 'ok') {
      return {
        success: true,
        message: 'File deleted successfully',
      };
    } else {
      throw new CloudinaryError('Failed to delete file from Cloudinary');
    }
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new CloudinaryError(
      error.message || 'Failed to delete file from Cloudinary'
    );
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {Array<string>} publicIds - Array of public IDs
 * @param {string} resource_type - Cloudinary resource type
 * @returns {Promise<Array>} - Array of deletion results
 */
export const deleteMultipleFromCloudinary = async (publicIds, resource_type = 'image') => {
  try {
    const deletePromises = publicIds.map((publicId) =>
      deleteFromCloudinary(publicId, resource_type)
    );
    return await Promise.all(deletePromises);
  } catch (error) {
    console.error('Multiple files deletion error:', error);
    throw new CloudinaryError(
      error.message || 'Failed to delete files from Cloudinary'
    );
  }
};

/**
 * Get optimized image URL with transformations
 * @param {string} publicId - The public ID of the image
 * @param {Object} options - Transformation options
 * @returns {string} - Transformed image URL
 */
export const getOptimizedImageUrl = (publicId, options = {}) => {
  // Ensure Cloudinary is configured
  configureCloudinary();

  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
  } = options;

  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop },
      { quality, fetch_format: format },
    ],
  });
};

export default {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  getOptimizedImageUrl,
  validateFileType,
  ALLOWED_FILE_TYPES,
};
