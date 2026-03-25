import { logger } from '../utils/logger.js';

import expressAsyncHandler from 'express-async-handler';
import axios from 'axios';

import subscriptionPlanServices from '../services/master/subscriptionPlanServices.js';
import subscriptionServices from '../services/master/subscriptionServices.js';
import paymentServices from '../services/master/paymentServices.js';
import generatePaymentReference from '../utils/generatePaymentReference.js';
import { getMasterConnection } from '../config/masterDB.js';
import { getTenantModel } from '../models/master/Tenants.js';
import databaseNameSlugger from '../utils/databaNameSlugger.js';
import calculateEndDate from '../utils/calculateEndDate.js';
import { PAYMENT_STATUS, STARTUP_SEED_CONFIG } from '../constants/constants.js';
import { getSubscriptionModel } from '../models/master/Subscriptions.js';

const HITPAY_MIN_AMOUNT = 0.3;
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isInternalPlan = (plan) => normalizeText(plan?.name) === normalizeText(STARTUP_SEED_CONFIG.planName);

const checkCheckoutEligibility = async (subscriptionData = {}) => {
  const companyName = String(subscriptionData?.companyName || '').trim();
  const normalizedCompanyCode = String(subscriptionData?.companyCode || '').trim().toLowerCase();
  const databaseName = databaseNameSlugger(companyName);
  const subscriptionPlanId = subscriptionData?.subscriptionPlanId;

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);

  if (!companyName || !normalizedCompanyCode) {
    return {
      isEligible: false,
      message: 'companyName and companyCode are required',
      statusCode: 400,
    };
  }

  const existingTenant = await Tenant.findOne({
    $or: [
      { companyCode: normalizedCompanyCode },
      { databaseName },
    ],
  }).lean();

  if (existingTenant) {
    return {
      isEligible: false,
      message: `Company already exists`,
      statusCode: 409,
    };
  }

  if (subscriptionPlanId) {
    const plan = await subscriptionPlanServices.getSubscriptionPlanById(subscriptionPlanId);

    if (isInternalPlan(plan)) {
      const existingInternalSubscription = await Subscription.findOne({
        subscriptionPlanId: plan._id,
      }).lean();

      if (existingInternalSubscription) {
        return {
          isEligible: false,
          message: 'Internal plan is limited to one subscriber only',
          statusCode: 409,
        };
      }
    }
  }

  return {
    isEligible: true,
    statusCode: 200,
    normalizedCompanyCode,
  };
};

const createHitpayCheckout = expressAsyncHandler(async (req, res) => {
  try {
    const subscriptionData = req.body?.subscriptionData || {};
    const agentData = req.body?.agentData || {};

    const { subscriptionPlanId, subscriptionStart } = subscriptionData || {};

    // Validate required subscription data
    if (!subscriptionPlanId || !subscriptionStart) {
      return res.status(400).json({
        success: false,
        message: 'subscriptionPlanId and subscriptionStart are required',
      });
    }

    const eligibility = await checkCheckoutEligibility({
      ...subscriptionData,
      subscriptionPlanId,
    });
    if (!eligibility.isEligible) {
      logger.warn(`Checkout rejected before payment initialization: ${eligibility.message}`);
      return res.status(eligibility.statusCode).json({
        success: false,
        message: eligibility.message,
      });
    }

    subscriptionData.companyCode = eligibility.normalizedCompanyCode;

    // Fetch plan to get price
    const plan = await subscriptionPlanServices.getSubscriptionPlanById(subscriptionPlanId);
    const amount = plan?.price;
    const normalizedPlanName = String(plan?.name || '').trim().toLowerCase();
    const isFreePlan = amount === 0 || normalizedPlanName.includes('free');

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan price is invalid',
      });
    }

    if (!isFreePlan && amount < HITPAY_MIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Subscription plan price must be at least ${HITPAY_MIN_AMOUNT} for HitPay checkout`,
      });
    }

    subscriptionData.subscriptionEnd = calculateEndDate(
      subscriptionStart,
      plan?.billingCycle || 'monthly',
      plan?.interval || 1
    );

    // Generate unique payment reference
    const referenceNumber = generatePaymentReference();

    if (isFreePlan) {
      const result = await subscriptionServices.subscribeTenantToPlan({
        subscriptionData,
        agentData,
        paymentData: {
          amount,
          referenceNumber,
          status: PAYMENT_STATUS.COMPLETED,
        },
      });

      logger.info(`Free subscription provisioned without HitPay for company ${subscriptionData.companyName}`);

      return res.status(201).json({
        success: true,
        message: 'Free subscription activated successfully',
        paymentReference: result?.payment?.referenceNumber || referenceNumber,
        amount,
        planName: plan.name,
        tenant: result?.tenant?._id,
        subscription: result?.subscription?._id,
        payment: result?.payment?._id,
        agent: result?.agent?._id,
        isHitpayBypassed: true,
      });
    }

    // Create payment record with subscription context (pending state)
    const paymentRecord = await paymentServices.createPaymentSession({
      amount,
      referenceNumber,
      subscriptionData,
      agentData,
    });

    // Call HitPay API to create payment session
    const hitpayResponse = await createHitpaySession({
      referenceNumber,
      amount,
      subscriptionData,
      paymentRecord,
    });

    if (!hitpayResponse?.checkoutUrl) {
      throw new Error(
        `Failed to create HitPay checkout session: checkout URL missing in API response (paymentRequestId=${hitpayResponse?.paymentRequestId || 'n/a'})`
      );
    }

    // Update payment record with HitPay details
    await paymentServices.updatePaymentHitpayDetails(paymentRecord._id, {
      hitpayPaymentRequestId: hitpayResponse.paymentRequestId,
      hitpayCheckoutUrl: hitpayResponse.checkoutUrl,
    });

    logger.info(`Created HitPay checkout for reference ${referenceNumber}, amount ${amount}`);

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      paymentReference: referenceNumber,
      checkoutUrl: hitpayResponse.checkoutUrl,
      amount,
      planName: plan.name,
    });
  } catch (error) {
    logger.error(`Error creating HitPay checkout: ${error.message}`);
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
});

const createHitpaySession = async ({ referenceNumber, amount, subscriptionData, paymentRecord }) => {
  const apiKey = process.env.HITPAY_API_KEY;
  const apiBaseUrl = process.env.HITPAY_API_BASE_URL;
  const webhookUrl = process.env.HITPAY_WEBHOOK_URL;
  const redirectUrl = process.env.HITPAY_REDIRECT_URL;

  if (!apiKey || !apiBaseUrl) {
    throw new Error('HitPay API credentials not configured');
  }

  let resolvedRedirectUrl = redirectUrl;
  try {
    if (redirectUrl) {
      const redirect = new URL(redirectUrl);
      redirect.searchParams.set('reference', referenceNumber);
      resolvedRedirectUrl = redirect.toString();
    }
  } catch (_error) {
    resolvedRedirectUrl = `${redirectUrl}?reference=${encodeURIComponent(referenceNumber)}`;
  }

  try {
    const response = await axios.post(`${apiBaseUrl}/v1/payment-requests`, {
      amount,
      currency: 'PHP', // Aligning with Singapore sandbox defaults
      reference_number: referenceNumber,
      description: `Payment for ${subscriptionData?.companyName || 'Subscription'}`,
      webhook: webhookUrl,
      redirect_url: resolvedRedirectUrl,
      // Store subscription context for webhook to retrieve
      custom_data: JSON.stringify({
        subscriptionData,
        paymentRecordId: paymentRecord._id.toString(),
      }),
    }, {
      headers: {
        'X-BUSINESS-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const responseData = response?.data || {};
    const checkoutUrl =
      responseData?.checkout_url ||
      responseData?.url ||
      responseData?.payment_url ||
      responseData?.payment_request_url ||
      responseData?.redirect_url ||
      responseData?.payment_request?.checkout_url ||
      responseData?.payment_request?.url ||
      null;

    const paymentRequestId =
      responseData?.id ||
      responseData?.payment_request_id ||
      responseData?.payment_request?.id ||
      null;

    if (!checkoutUrl) {
      logger.error(`HitPay response missing checkout URL. payload=${JSON.stringify(responseData)}`);
    }

    return {
      paymentRequestId,
      checkoutUrl,
      status: responseData?.status || responseData?.payment_request?.status,
    };
  } catch (error) {
    const hitpayError = error.response?.data?.message || error.response?.data?.error || error.message;
    logger.error(`HitPay API error: ${hitpayError}`);
    throw new Error(`HitPay API call failed: ${hitpayError}`);
  }
};

const getPaymentSetupStatus = expressAsyncHandler(async (req, res) => {
  const reference = String(req.query?.reference || req.query?.referenceNumber || '').trim();
  const paymentRequestId = String(req.query?.paymentRequestId || req.query?.payment_id || '').trim();

  if (!reference && !paymentRequestId) {
    return res.status(400).json({
      success: false,
      message: 'reference or paymentRequestId is required',
    });
  }

  let payment = null;

  if (reference) {
    payment = await paymentServices.findPaymentByReferenceNumber(reference);
  }

  if (!payment && paymentRequestId) {
    payment = await paymentServices.findPaymentByHitpayPaymentRequestId(paymentRequestId);
  }

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment session not found',
      status: 'NOT_FOUND',
      isProvisioned: false,
    });
  }

  const isProvisioned =
    payment?.status === PAYMENT_STATUS.COMPLETED &&
    Boolean(payment?.tenantId) &&
    Boolean(payment?.subscriptionId);

  let apiKey = '';
  if (isProvisioned) {
    const { APIKey } = getMasterConnection();
    const keyRecord = await APIKey.findOne({
      tenantId: payment.tenantId,
      subscriptionId: payment.subscriptionId,
    }).lean();
    apiKey = keyRecord?.apiKey || '';
  }

  return res.status(200).json({
    success: true,
    status: payment?.status || PAYMENT_STATUS.PENDING,
    isProvisioned,
    paymentReference: payment?.referenceNumber,
    paymentRequestId: payment?.hitpayPaymentRequestId,
    tenantId: payment?.tenantId,
    subscriptionId: payment?.subscriptionId,
    apiKey,
  });
});

export {
  createHitpayCheckout,
  getPaymentSetupStatus,
};
