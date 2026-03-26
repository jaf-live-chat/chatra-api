import mongoose from "mongoose";

const passwordResetOTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Auto-delete expired records
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const getPasswordResetOTPModel = (tenantConnection) => {
  if (tenantConnection.models.PasswordResetOTP) {
    return tenantConnection.models.PasswordResetOTP;
  }
  return tenantConnection.model("PasswordResetOTP", passwordResetOTPSchema);
};
