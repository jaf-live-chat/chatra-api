import { logger } from '../utils/logger.js';

import expressAsyncHandler from 'express-async-handler';
import axios from 'axios';

import subscriptionPlanServices from '../services/master/subscriptionPlanServices.js';
import paymentServices from '../services/master/paymentServices.js';
import generatePaymentReference from '../utils/generatePaymentReference.js';
import { getMasterConnection } from '../config/masterDB.js';
import { getTenantModel } from '../models/master/Tenants.js';
import databaseNameSlugger from '../utils/databaNameSlugger.js';

const checkCheckoutEligibility = async (subscriptionData = {}) => {
  const companyName = String(subscriptionData?.companyName || '').trim();
  const normalizedCompanyCode = String(subscriptionData?.companyCode || '').trim().toLowerCase();
  const databaseName = databaseNameSlugger(companyName);

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);

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
      message: `Company already exists (companyCode: ${existingTenant.companyCode})`,
      statusCode: 409,
    };
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

    const { subscriptionPlanId, subscriptionStart, subscriptionEnd } = subscriptionData || {};

    // Validate required subscription data
    if (!subscriptionPlanId || !subscriptionStart || !subscriptionEnd) {
      return res.status(400).json({
        success: false,
        message: 'subscriptionPlanId, subscriptionStart, and subscriptionEnd are required',
      });
    }

    const eligibility = await checkCheckoutEligibility(subscriptionData);
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

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan price is invalid',
      });
    }

    // Generate unique payment reference
    const referenceNumber = generatePaymentReference();

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

  try {
    const response = await axios.post(`${apiBaseUrl}/v1/payment-requests`, {
      amount,
      currency: 'PHP', // Aligning with Singapore sandbox defaults
      reference_number: referenceNumber,
      description: `Payment for ${subscriptionData?.companyName || 'Subscription'}`,
      webhook: webhookUrl,
      redirect_url: redirectUrl,
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

export {
  createHitpayCheckout,
};
