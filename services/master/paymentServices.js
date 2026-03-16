import { getPaymentModel } from '../../models/master/Payments.js'
import { getMasterConnection } from '../../config/masterDB.js'

const createPayment = async (paymentData, options = {}) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);
  const { session } = options;

  const [newPayment] = await Payment.create(
    [
      {
        tenantId: paymentData?.tenantId,
        subscriptionId: paymentData?.subscriptionId,
        amount: paymentData?.amount,
        referenceNumber: paymentData?.referenceNumber,
        status: paymentData?.status,
      },
    ],
    session ? { session } : undefined
  );

  return newPayment;

}

const deletePaymentById = async (paymentId) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  await Payment.deleteOne({ _id: paymentId });
}

export default {
  createPayment,
  deletePaymentById,
}