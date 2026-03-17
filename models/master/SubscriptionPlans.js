import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  price: {
    type: Number,
    required: true
  },

  trialDays: {
    type: Number,
    default: 0
  },

  limits: {
    maxAgents: {
      type: Number,
      default: 1
    },

    maxWebsites: {
      type: Number,
      default: 1
    },

    maxConversationsPerMonth: {
      type: Number,
      default: 1000
    },

    maxStorageMB: {
      type: Number,
      default: 500
    }
  },

  features: {
    analytics: {
      type: Boolean,
      default: false
    },

    fileSharing: {
      type: Boolean,
      default: false
    },

    visitorTracking: {
      type: Boolean,
      default: true
    },

    prioritySupport: {
      type: Boolean,
      default: false
    }
  },

  isPosted: {
    type: Boolean,
    default: true
  },
},
  {
    timestamps: true
  }
);

export const getSubscriptionPlanModel = (connection) => {
  if (connection.models.SubscriptionPlan) return connection.models.SubscriptionPlan;
  return connection.model("SubscriptionPlan", subscriptionPlanSchema);
}