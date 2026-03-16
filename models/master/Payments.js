import mongoose from 'mongoose'
import { PAYMENT_STATUS } from '../../constants/constants.js'

const paymentsSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    }
  }
)

export const getPaymentModel = (connection) => {
  if (connection.models.Payment) return connection.models.Payment;
  return connection.model('Payment', paymentsSchema);
}