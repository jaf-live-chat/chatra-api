import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
)

export const getUserModel = (tenantConnection) => {
  return tenantConnection.model('User', userSchema);
}