import mongoose from 'mongoose'
import { PAYMENT_STATUS } from '../../constants/constants.js'

const paymentsSchema = new mongoose.Schema(
  {
    // Optional: filled only after payment succeeds and subscription is provisioned
    tenantId: {
      type: mongoose.Types.ObjectId,
      ref: 'Tenant',
      required: false,
    },
    subscriptionId: {
      type: mongoose.Types.ObjectId,
      ref: 'Subscription',
      required: false,
    },
    amount: {
      type: Number,
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    // Store subscription context for pending payments (before they're provisioned)
    subscriptionContext: {
      subscriptionData: {
        companyName: String,
        companyCode: String,
        subscriptionPlanId: String,
        tenantId: String,
        currentSubscriptionId: String,
        subscriptionStart: Date,
        subscriptionEnd: Date,
      },
      agentData: {
        fullName: String,
        emailAddress: String,
        password: String,
        phoneNumber: String,
        role: String,
      },
    },
    // HitPay-specific fields
    hitpayPaymentRequestId: {
      type: String,
      required: false,
    },
    hitpayCheckoutUrl: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
)

export const getPaymentModel = (connection) => {
  if (connection.models.Payment) return connection.models.Payment;
  return connection.model('Payment', paymentsSchema);
}