import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    subscriptionId: {
      type: mongoose.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
    }
  },
  {
    timestamps: true,
  }
)

export const getAPIKeyModel = (connection) => {
  if (connection.models.APIKey) return connection.models.APIKey;
  return connection.model('APIKey', apiKeySchema);
}