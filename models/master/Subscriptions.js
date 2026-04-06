import mongoose from 'mongoose';
import { TENANT_STATUS } from '../../constants/constants.js';

const subscriptionConfigurationSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingCycle: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    interval: {
      type: Number,
      required: true,
      min: 1,
    },
    limits: {
      maxAgents: {
        type: Number,
        default: 1,
      },
      maxWebsites: {
        type: Number,
        default: 1,
      },
    },
    features: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    subscriptionPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'SubscriptionPlan',
    },
    subscriptionStart: {
      type: Date,
      required: true,
    },
    subscriptionEnd: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TENANT_STATUS),
    },
    configuration: {
      type: subscriptionConfigurationSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

export const getSubscriptionModel = (connection) => {
  if (connection.models.Subscription) return connection.models.Subscription;
  return connection.model('Subscription', subscriptionSchema);
}