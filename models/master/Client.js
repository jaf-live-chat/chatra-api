
import mongoose from 'mongoose';
import { TENANT_STATUS, SUBSCRIPTION_PLANS } from '../../constants/constants.js';

const clientSchema = new mongoose.Schema(
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
    },
    status: {
      type: String,
      enum: Object.values(TENANT_STATUS),
      default: TENANT_STATUS.ACTIVATED,
    },
    subscriptionPlan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLANS),
      default: SUBSCRIPTION_PLANS.FREE,
    },
    subscriptionStart: {
      type: Date,
      default: null,
    },
    subscriptionEnd: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'clients',
  }
);

clientSchema.index({ apiKey: 1 });

export const getClientModel = (connection) => {
  if (connection.models.Client) return connection.models.Client;
  return connection.model('Client', clientSchema);
};
