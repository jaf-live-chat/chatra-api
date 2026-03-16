import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
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
    },
    useAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    }
  },
  {
    timestamps: true,
  }
)

export const getVisitorModel = (tenantConnection) => {
  if (tenantConnection.models.Visitors) return tenantConnection.models.Visitors;
  return tenantConnection.model('Visitor', visitorSchema);
}