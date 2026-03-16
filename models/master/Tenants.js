
import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    databaseName: {
      type: String,
      required: [true, 'Database name is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    companyCode: {
      type: String,
      required: [true, 'Company code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, 'Company code must be at least 3 characters'],
      maxlength: [5, 'Company code cannot exceed 5 characters'],
      match: [/^[A-Z0-9]+$/, 'Company code must be alphanumeric'],
    },
    apiKey: {
      type: String,
      required: [true, 'API key is required'],
      unique: true,
      trim: true,
    }
  },
  {
    timestamps: true,
  }
);

export const getTenantModel = (connection) => {
  if (connection.models.Tenant) return connection.models.Tenant;
  return connection.model('Tenant', tenantSchema);
};
