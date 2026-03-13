import mongoose from 'mongoose';
import { TENANT_STATUS, SUBSCRIPTION_PLANS } from '../../constants/constants.js';

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    subscriptionPlan: {
      type: String,
      required: [true, 'Subscription plan is required'],
      enum: Object.values(SUBSCRIPTION_PLANS),
    },
    subscriptionStart: {
      type: Date,
      required: [true, 'Subscription start date is required'],
    },
    subscriptionEnd: {
      type: Date,
      required: [true, 'Subscription end date is required'],
    },
    status: {
      type: String,
      required: [true, 'Subscription status is required'],
      enum: Object.values(TENANT_STATUS),
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