import { getPaymentModel } from '../../models/master/Payments.js'
import { getMasterConnection } from '../../config/masterDB.js'
import { PAYMENT_STATUS } from '../../constants/constants.js';

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

const createPaymentSession = async (sessionData) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  const [newPayment] = await Payment.create([
    {
      amount: sessionData?.amount,
      referenceNumber: sessionData?.referenceNumber,
      status: PAYMENT_STATUS.PENDING,
      subscriptionContext: {
        subscriptionData: sessionData?.subscriptionData,
        agentData: sessionData?.agentData,
      },
    },
  ]);

  return newPayment;
};

const deletePaymentById = async (paymentId) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  await Payment.deleteOne({ _id: paymentId });
}

const findPaymentByReferenceNumber = async (referenceNumber) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  return Payment.findOne({ referenceNumber }).lean();
}

const findPaymentByHitpayPaymentRequestId = async (hitpayPaymentRequestId) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  return Payment.findOne({ hitpayPaymentRequestId }).lean();
}

const updatePaymentStatusByReferenceNumber = async (referenceNumber, status = PAYMENT_STATUS.COMPLETED) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  return Payment.findOneAndUpdate(
    { referenceNumber },
    { $set: { status } },
    { new: true }
  );
}

const updatePaymentHitpayDetails = async (paymentId, details = {}) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  return Payment.findByIdAndUpdate(
    paymentId,
    {
      $set: {
        hitpayPaymentRequestId: details.hitpayPaymentRequestId,
        hitpayCheckoutUrl: details.hitpayCheckoutUrl,
      },
    },
    { new: true }
  );
};

const updatePaymentAfterProvisioning = async (paymentId, tenantId, subscriptionId) => {
  const { connection } = getMasterConnection();
  const Payment = getPaymentModel(connection);

  return Payment.findByIdAndUpdate(
    paymentId,
    {
      $set: {
        tenantId,
        subscriptionId,
        status: PAYMENT_STATUS.COMPLETED,
      },
      $unset: {
        subscriptionContext: 1,
      },
    },
    { new: true }
  );
};

export default {
  createPayment,
  createPaymentSession,
  deletePaymentById,
  findPaymentByReferenceNumber,
  findPaymentByHitpayPaymentRequestId,
  updatePaymentStatusByReferenceNumber,
  updatePaymentHitpayDetails,
  updatePaymentAfterProvisioning,
}