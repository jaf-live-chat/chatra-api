import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    visitorToken: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
    },
    userAgent: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
    },
    useAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    }
  },
  {
    timestamps: true,
  }
)

export const getVisitorModel = (tenantConnection) => {
  if (tenantConnection.models.Visitor) return tenantConnection.models.Visitor;
  return tenantConnection.model('Visitor', visitorSchema);
}