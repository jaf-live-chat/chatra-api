
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
