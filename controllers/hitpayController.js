import expressAsyncHandler from 'express-async-handler';

import { PAYMENT_STATUS } from '../constants/constants.js';
import subscriptionServices from '../services/master/subscriptionServices.js';
import paymentServices from '../services/master/paymentServices.js';
import hitpayService from '../services/hitpayService.js';
import { logger } from '../utils/logger.js';

const inFlightReferences = new Set();
const RETRYABLE_ERROR_MESSAGE_FRAGMENT = 'please retry your operation or multi-document transaction';

const isRetryableMongoError = (error) => {
  const labels = error?.errorLabels || [];
  const message = String(error?.message || '').toLowerCase();

  return (
    labels.includes('TransientTransactionError') ||
    labels.includes('UnknownTransactionCommitResult') ||
    message.includes(RETRYABLE_ERROR_MESSAGE_FRAGMENT)
  );
};

const safeSerialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return '[unserializable-payload]';
  }
};

const handleHitpayWebhook = expressAsyncHandler(async (req, res) => {
  const rawReference = req.body?.reference_number || req.body?.referenceNumber || req.body?.reference || 'n/a';

  logger.info(
    `HitPay webhook received: method=${req.method} path=${req.originalUrl} contentType=${req.headers['content-type'] || 'n/a'} reference=${rawReference}`
  );
  logger.debug(`HitPay webhook headers: ${safeSerialize({
    'x-hitpay-signature': req.headers['x-hitpay-signature'],
    'x-hitpay-hmac': req.headers['x-hitpay-hmac'],
    'x-hitpay-hmac-signature': req.headers['x-hitpay-hmac-signature'],
    'hitpay-signature': req.headers['hitpay-signature'],
  })}`);
  logger.debug(`HitPay webhook payload: ${safeSerialize(req.body)}`);

  try {
    const isValidSignature = hitpayService.verifyWebhookSignature({
      payload: req.body,
      headers: req.headers,
      rawBody: req.rawBody,
    });

    if (!isValidSignature) {
      logger.warn(
        `HitPay webhook ignored: invalid signature (reference=${rawReference})`
      );
      return res.status(200).json({ success: true, message: 'Webhook ignored (invalid signature)' });
    }

    const normalizedPayload = hitpayService.normalizeWebhookPayload(req.body);
    logger.info(`HitPay webhook normalized payload: ${safeSerialize(normalizedPayload)}`);

    if (!normalizedPayload?.isSuccessfulPayment) {
      logger.info(
        `HitPay webhook ignored: event/status is not successful (event=${normalizedPayload?.eventType || 'n/a'}, status=${normalizedPayload?.status || 'n/a'})`
      );
      return res.status(200).json({
        success: true,
        message: 'Webhook event ignored (not a successful payment)',
      });
    }

    const paymentReference = normalizedPayload?.paymentReference;
    const hitpayPaymentRequestId = normalizedPayload?.paymentId;

    if (!paymentReference && !hitpayPaymentRequestId) {
      logger.warn('HitPay webhook ignored: missing payment identifiers');
      return res.status(200).json({ success: true, message: 'Webhook ignored (missing payment identifiers)' });
    }

    const idempotencyKey = paymentReference || `hitpay:${hitpayPaymentRequestId}`;

    if (inFlightReferences.has(idempotencyKey)) {
      logger.info(`HitPay webhook skipped: already in-flight for key=${idempotencyKey}`);
      return res.status(200).json({
        success: true,
        message: 'Webhook already being processed',
      });
    }

    let existingPayment = null;

    if (paymentReference) {
      existingPayment = await paymentServices.findPaymentByReferenceNumber(paymentReference);
    }

    if (!existingPayment && hitpayPaymentRequestId) {
      existingPayment = await paymentServices.findPaymentByHitpayPaymentRequestId(hitpayPaymentRequestId);
    }

    if (!existingPayment) {
      logger.warn(
        `HitPay webhook ignored: payment record not found for reference=${paymentReference || 'n/a'} paymentRequestId=${hitpayPaymentRequestId || 'n/a'}`
      );
      return res.status(200).json({ success: true, message: 'Webhook ignored (payment record not found)' });
    }

    if (existingPayment?.status === PAYMENT_STATUS.COMPLETED) {
      logger.info(`HitPay webhook idempotent skip: payment already completed (reference=${existingPayment.referenceNumber})`);
      return res.status(200).json({
        success: true,
        message: 'Payment already provisioned',
      });
    }

    inFlightReferences.add(idempotencyKey);

    res.status(200).json({
      success: true,
      message: 'Webhook accepted',
      paymentReference: existingPayment.referenceNumber,
    });

    // Process subscription provisioning asynchronously after returning HTTP 200
    void (async () => {
      try {
        const subscriptionContext = existingPayment?.subscriptionContext;

        if (!subscriptionContext?.subscriptionData || !subscriptionContext?.agentData) {
          throw new Error('Payment record missing subscription context');
        }

        const provisioningPayload = {
          subscriptionData: subscriptionContext.subscriptionData,
          agentData: subscriptionContext.agentData,
          paymentData: {
            existingPaymentId: existingPayment._id,
            amount: existingPayment.amount,
            referenceNumber: existingPayment.referenceNumber,
            status: PAYMENT_STATUS.COMPLETED,
          },
        };

        logger.info(`HitPay webhook provisioning started: reference=${existingPayment.referenceNumber}`);

        let result = null;
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            result = await subscriptionServices.subscribeTenantToPlan(provisioningPayload);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;

            if (!isRetryableMongoError(error) || attempt === 2) {
              throw error;
            }

            logger.warn(
              `HitPay webhook transient provisioning error on attempt ${attempt}/2 for reference ${existingPayment.referenceNumber}: ${error.message}`
            );
          }
        }

        if (!result && lastError) {
          throw lastError;
        }

        if (result?.tenant?._id && result?.subscription?._id) {
          await paymentServices.updatePaymentAfterProvisioning(
            existingPayment._id,
            result.tenant._id,
            result.subscription._id
          );
        }

        logger.info(
          `HitPay webhook processed: reference=${existingPayment.referenceNumber}, tenant=${result?.tenant?._id}`
        );
      } catch (error) {
        logger.error(
          `HitPay webhook provisioning failed for reference ${existingPayment.referenceNumber}: ${error.message}`
        );
      } finally {
        inFlightReferences.delete(idempotencyKey);
      }
    })();

    return;
  } catch (error) {
    logger.error(`HitPay webhook processing error: ${error.message}`);
    return res.status(200).json({ success: true, message: 'Webhook received (processing error logged)' });
  }
});

export {
  handleHitpayWebhook,
};
