import mongoose from "mongoose";
import { USER_ROLES, USER_STATUS } from "../../constants/constants.js";

const agentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    emailAddress: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES).map((v) => v.value),
      required: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: false,
    },
    totalResolved: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    selfPickEligible: {
      type: Boolean,
      default: false,
    },
    selfPickEligibleAt: {
      type: Date,
      default: null,
    },
    selfPickConsumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

export const getAgentModel = (tenantConnection) => {
  if (tenantConnection.models.Agent) return tenantConnection.models.Agent;
  return tenantConnection.model('Agent', agentSchema);
}