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
    required: true
  },

  limits: {
    maxAgents: {
      type: Number,
      required: true
    },

    maxWebsites: {
      type: Number,
      required: true
    },

    maxConversationsPerMonth: {
      type: Number,
      required: true
    },

    maxStorageMB: {
      type: Number,
      required: true
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