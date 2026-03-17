import mongoose from 'mongoose';
import { TENANT_STATUS, SUBSCRIPTION_PLANS } from '../../constants/constants.js';

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
      required: true
    },
    status: {
      type: String,
      required: true,
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