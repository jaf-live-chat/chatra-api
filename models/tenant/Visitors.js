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
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    ipAddressConsent: {
      type: Boolean,
      default: false,
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
    locationCity: {
      type: String,
      trim: true,
      default: null,
    },
    locationCountry: {
      type: String,
      trim: true,
      default: null,
    },
    locationSource: {
      type: String,
      trim: true,
      default: null,
    },
    locationConsent: {
      type: Boolean,
      default: false,
    },
    locationResolvedAt: {
      type: Date,
      default: null,
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