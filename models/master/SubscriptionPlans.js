import mongoose from "mongoose";

const BILLING_CYCLE_VALUES = ["daily", "weekly", "monthly", "yearly"];

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

  billingCycle: {
    type: String,
    required: true,
    enum: BILLING_CYCLE_VALUES,
    lowercase: true,
    trim: true,
  },

  interval: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: "interval must be an integer greater than or equal to 1",
    },
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
  },

  features: {
    type: [String],
    required: true,
  },

  isMostPopular: {
    type: Boolean,
    default: false
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