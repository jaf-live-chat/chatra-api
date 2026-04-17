import { logger } from '../utils/logger.js';

import expressAsyncHandler from 'express-async-handler';
import axios from 'axios';

import { getEnv } from '../config/envResolver.js';
import subscriptionPlanServices from '../services/master/subscriptionPlanServices.js';
import subscriptionServices from '../services/master/subscriptionServices.js';
import paymentServices from '../services/master/paymentServices.js';
import generatePaymentReference from '../utils/generatePaymentReference.js';
import { getMasterConnection } from '../config/masterDB.js';
import { getTenantConnection } from '../config/tenantDB.js';
import { getTenantModel } from '../models/master/Tenants.js';
import databaseNameSlugger from '../utils/databaNameSlugger.js';
import calculateEndDate from '../utils/calculateEndDate.js';
import { PAYMENT_STATUS, STARTUP_SEED_CONFIG, TENANT_STATUS } from '../constants/constants.js';
import { getSubscriptionModel } from '../models/master/Subscriptions.js';
import hitpayService from '../services/hitpayService.js';

const HITPAY_MIN_AMOUNT = 0.3;
const inFlightProvisioningRecoveries = new Set();
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isInternalPlan = (plan) => normalizeText(plan?.name) === normalizeText(STARTUP_SEED_CONFIG.planName);

const sanitizeFeatureList = (features = []) => {
  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map((feature) => String(feature || '').trim())
    .filter(Boolean);
};

const formatPrice = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return `PHP ${numericValue.toFixed(2)}`;
};

const buildFeatureComparison = (previousFeatures = [], newFeatures = []) => {
  const previousFeatureList = sanitizeFeatureList(previousFeatures);
  const newFeatureList = sanitizeFeatureList(newFeatures);

  const previousFeatureSet = new Set(previousFeatureList.map((feature) => feature.toLowerCase()));
  const newFeatureSet = new Set(newFeatureList.map((feature) => feature.toLowerCase()));

  const addedFeatures = newFeatureList.filter((feature) => !previousFeatureSet.has(feature.toLowerCase()));
  const removedFeatures = previousFeatureList.filter((feature) => !newFeatureSet.has(feature.toLowerCase()));
  const unchangedFeatures = newFeatureList.filter((feature) => previousFeatureSet.has(feature.toLowerCase()));

  return {
    addedFeatures,
    removedFeatures,
    unchangedFeatures,
  };
};

const getProvisionedTenantDetails = async (tenantId) => {
  if (!tenantId) {
    return {
      tenantEmail: '',
      companyName: '',
    };
  }

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const tenant = await Tenant.findById(tenantId).lean();

  if (!tenant?.databaseName) {
    return {
      tenantEmail: '',
      companyName: tenant?.companyName || '',
    };
  }

  const { Agents } = getTenantConnection(tenant.databaseName);
  const adminAgent = await Agents.findOne({}, { emailAddress: 1 })
    .sort({ createdAt: 1 })
    .lean();

  return {
    tenantEmail: adminAgent?.emailAddress || '',
    companyName: tenant?.companyName || '',
  };
};

const recoverProvisioningFromPayment = async (payment, recoverySource = 'status-check') => {
  if (!payment?._id) {
    return { started: false, reason: 'missing-payment-record' };
  }

  const recoveryKey = String(payment._id);

  if (inFlightProvisioningRecoveries.has(recoveryKey)) {
    return { started: false, reason: 'already-in-flight' };
  }

  const subscriptionData = payment?.subscriptionContext?.subscriptionData || {};
  const agentData = payment?.subscriptionContext?.agentData || {};

  if (!subscriptionData?.subscriptionPlanId) {
    return { started: false, reason: 'missing-subscription-context' };
  }

  const isTenantPlanChange = Boolean(subscriptionData?.tenantId || subscriptionData?.currentSubscriptionId);

  if (!isTenantPlanChange && !agentData?.emailAddress) {
    return { started: false, reason: 'missing-agent-context' };
  }

  inFlightProvisioningRecoveries.add(recoveryKey);

  void (async () => {
    try {
      logger.info(
        `HitPay recovery provisioning started from ${recoverySource}: reference=${payment.referenceNumber} paymentId=${payment._id}`
      );

      const result = await subscriptionServices.subscribeTenantToPlan({
        subscriptionData: {
          ...subscriptionData,
          tenantId: subscriptionData?.tenantId || '',
          currentSubscriptionId: subscriptionData?.currentSubscriptionId || '',
        },
        agentData,
        paymentData: {
          existingPaymentId: payment._id,
          amount: payment.amount,
          referenceNumber: payment.referenceNumber,
          status: PAYMENT_STATUS.COMPLETED,
        },
      });

      if (result?.tenant?._id && result?.subscription?._id) {
        await paymentServices.updatePaymentAfterProvisioning(
          payment._id,
          result.tenant._id,
          result.subscription._id
        );
      }

      logger.info(
        `HitPay recovery provisioning completed from ${recoverySource}: reference=${payment.referenceNumber} tenant=${result?.tenant?._id || 'n/a'}`
      );
    } catch (error) {
      logger.error(
        `HitPay recovery provisioning failed from ${recoverySource}: reference=${payment.referenceNumber} error=${error.message}`
      );
    } finally {
      inFlightProvisioningRecoveries.delete(recoveryKey);
    }
  })();

  return { started: true, reason: 'recovery-started' };
};

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

    const { subscriptionPlanId, subscriptionStart, tenantId } = subscriptionData || {};

    if (!subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        message: 'subscriptionPlanId is required',
      });
    }

    const plan = await subscriptionPlanServices.getSubscriptionPlanById(subscriptionPlanId);
    const amount = plan?.price;
    const normalizedPlanName = String(plan?.name || '').trim().toLowerCase();
    const isFreePlan = amount === 0 || normalizedPlanName.includes('free');

    if (tenantId) {
      const { connection } = getMasterConnection();
      const Tenant = getTenantModel(connection);
      const existingTenant = await Tenant.findById(tenantId).lean();

      if (!existingTenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      subscriptionData.subscriptionStart = subscriptionStart || new Date().toISOString();
      subscriptionData.companyName = subscriptionData.companyName || existingTenant.companyName;
      subscriptionData.companyCode = subscriptionData.companyCode || existingTenant.companyCode;

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Subscription plan price is invalid',
        });
      }

      if (isFreePlan) {
        return res.status(400).json({
          success: false,
          message: 'Plan changes require HitPay payment. Please select a paid plan.',
        });
      }

      if (!isFreePlan && amount < HITPAY_MIN_AMOUNT) {
        return res.status(400).json({
          success: false,
          message: `Subscription plan price must be at least ${HITPAY_MIN_AMOUNT} for HitPay checkout`,
        });
      }

      const referenceNumber = generatePaymentReference();

      const paymentRecord = await paymentServices.createPaymentSession({
        amount,
        referenceNumber,
        subscriptionData,
        agentData: {},
      });

      const hitpayResponse = await createHitpaySession({
        referenceNumber,
        amount,
        subscriptionData,
        paymentRecord,
        isSubscriptionChange: true,
      });

      if (!hitpayResponse?.checkoutUrl) {
        throw new Error(
          `Failed to create HitPay checkout session: checkout URL missing in API response (paymentRequestId=${hitpayResponse?.paymentRequestId || 'n/a'})`
        );
      }

      await paymentServices.updatePaymentHitpayDetails(paymentRecord._id, {
        hitpayPaymentRequestId: hitpayResponse.paymentRequestId,
        hitpayCheckoutUrl: hitpayResponse.checkoutUrl,
      });

      logger.info(`Created HitPay checkout for immediate tenant plan change ${tenantId}, reference ${referenceNumber}, amount ${amount}`);

      return res.status(200).json({
        success: true,
        message: 'Checkout session created successfully',
        paymentReference: referenceNumber,
        checkoutUrl: hitpayResponse.checkoutUrl,
        amount,
        planName: plan.name,
        tenant: tenantId,
        subscriptionChange: true,
      });
    }

    if (!subscriptionStart) {
      return res.status(400).json({
        success: false,
        message: 'subscriptionStart is required',
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
        shouldCreatePaymentRecord: false,
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
        paymentReference: referenceNumber,
        amount,
        planName: plan.name,
        tenant: result?.tenant?._id,
        subscription: result?.subscription?._id,
        payment: result?.payment?._id || null,
        agent: result?.agent?._id,
        tenantEmail: agentData?.emailAddress || '',
        companyName: result?.tenant?.companyName || subscriptionData.companyName || '',
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

const createHitpaySession = async ({ referenceNumber, amount, subscriptionData, paymentRecord, isSubscriptionChange = false }) => {
  const apiKey = getEnv('HITPAY_API_KEY');
  const apiBaseUrl = getEnv('HITPAY_API_BASE_URL');
  const webhookUrl = getEnv('HITPAY_WEBHOOK_URL');
  let redirectUrl = getEnv('HITPAY_REDIRECT_URL');

  // Use different redirect path for plan renewals
  if (isSubscriptionChange) {
    redirectUrl = redirectUrl?.replace('/setup', '/renewal') || '/renewal';
  }

  if (!apiKey || !apiBaseUrl) {
    throw new Error('HitPay API credentials not configured');
  }

  if (!webhookUrl) {
    throw new Error('HitPay webhook URL not configured');
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
  const tenantId = String(req.query?.tenantId || req.query?.tenant_id || '').trim();
  const subscriptionId = String(req.query?.subscriptionId || req.query?.subscription_id || '').trim();

  const hasPaymentLookup = Boolean(reference || paymentRequestId);
  const hasProvisioningLookup = Boolean(tenantId && subscriptionId);

  if (!hasPaymentLookup && !hasProvisioningLookup) {
    return res.status(400).json({
      success: false,
      message: 'reference/paymentRequestId or tenantId/subscriptionId is required',
    });
  }

  let payment = null;
  let resolvedTenantId = tenantId;
  let resolvedSubscriptionId = subscriptionId;
  let status = PAYMENT_STATUS.PENDING;

  if (reference) {
    payment = await paymentServices.findPaymentByReferenceNumber(reference);
  }

  if (!payment && paymentRequestId) {
    payment = await paymentServices.findPaymentByHitpayPaymentRequestId(paymentRequestId);
  }

  if (payment) {
    resolvedTenantId = payment?.tenantId ? String(payment.tenantId) : resolvedTenantId;
    resolvedSubscriptionId = payment?.subscriptionId
      ? String(payment.subscriptionId)
      : resolvedSubscriptionId;
    status = payment?.status || PAYMENT_STATUS.PENDING;
  } else {
    const { connection } = getMasterConnection();
    const Subscription = getSubscriptionModel(connection);
    const existingSubscription = await Subscription.findOne({
      _id: resolvedSubscriptionId,
      tenantId: resolvedTenantId,
    }).lean();

    if (!existingSubscription) {
      return res.status(404).json({
        success: false,
        message: 'Provisioning session not found',
        status: 'NOT_FOUND',
        isProvisioned: false,
      });
    }

    status = PAYMENT_STATUS.COMPLETED;
  }

  const hitpayLifecycle = payment?.hitpayPaymentRequestId
    ? await hitpayService.getPaymentRequestLifecycle(payment.hitpayPaymentRequestId)
    : null;

  const isPaymentCompletedByHitpay =
    status === PAYMENT_STATUS.COMPLETED || Boolean(hitpayLifecycle?.isCompleted);

  const isPaymentCancelledByHitpay = Boolean(hitpayLifecycle?.isCancelled);

  if (payment && isPaymentCancelledByHitpay && status !== PAYMENT_STATUS.CANCELLED) {
    await paymentServices.updatePaymentStatusByReferenceNumber(
      payment.referenceNumber,
      PAYMENT_STATUS.CANCELLED
    );
    status = PAYMENT_STATUS.CANCELLED;
  }

  if (
    payment &&
    !resolvedTenantId &&
    !resolvedSubscriptionId &&
    payment?.subscriptionContext?.subscriptionData?.subscriptionPlanId &&
    isPaymentCompletedByHitpay
  ) {
    const recovery = await recoverProvisioningFromPayment(payment, 'payment-status-check');

    if (recovery.started) {
      status = PAYMENT_STATUS.COMPLETED;
    }
  }

  const isProvisioned =
    status === PAYMENT_STATUS.COMPLETED &&
    Boolean(resolvedTenantId) &&
    Boolean(resolvedSubscriptionId);

  let apiKey = '';
  let tenantEmail = '';
  let companyName = '';
  let planName = '';
  let planPrice = '';
  let billingPeriod = '';
  let previousPlanName = '';
  let previousPlanPrice = '';
  let previousBillingPeriod = '';
  let newPlanFeatures = [];
  let previousPlanFeatures = [];
  let addedFeatures = [];
  let removedFeatures = [];
  let unchangedFeatures = [];

  if (isProvisioned) {
    const { APIKey, connection } = getMasterConnection();
    const Subscription = getSubscriptionModel(connection);

    const keyRecord = await APIKey.findOne({
      tenantId: resolvedTenantId,
      subscriptionId: resolvedSubscriptionId,
    }).lean();
    apiKey = keyRecord?.apiKey || '';

    const tenantDetails = await getProvisionedTenantDetails(resolvedTenantId);
    tenantEmail = tenantDetails.tenantEmail;
    companyName = tenantDetails.companyName;

    const newSubscription = await Subscription.findOne({
      _id: resolvedSubscriptionId,
      tenantId: resolvedTenantId,
    }).lean();

    const previousSubscriptionId = String(
      payment?.subscriptionContext?.subscriptionData?.currentSubscriptionId || ''
    ).trim();

    let previousSubscription = null;
    if (previousSubscriptionId) {
      previousSubscription = await Subscription.findOne({
        _id: previousSubscriptionId,
        tenantId: resolvedTenantId,
      }).lean();
    }

    if (!previousSubscription) {
      previousSubscription = await Subscription.findOne({
        tenantId: resolvedTenantId,
        _id: { $ne: resolvedSubscriptionId },
        status: TENANT_STATUS.ACTIVATED,
      })
        .sort({ updatedAt: -1 })
        .lean();
    }

    const newConfig = newSubscription?.configuration || {};
    const previousConfig = previousSubscription?.configuration || {};

    planName = newConfig?.planName || '';
    planPrice = formatPrice(newConfig?.price);
    billingPeriod = newConfig?.billingCycle ? `/${String(newConfig.billingCycle).toLowerCase()}` : '';
    newPlanFeatures = sanitizeFeatureList(newConfig?.features);

    previousPlanName = previousConfig?.planName || '';
    previousPlanPrice = formatPrice(previousConfig?.price);
    previousBillingPeriod = previousConfig?.billingCycle
      ? `/${String(previousConfig.billingCycle).toLowerCase()}`
      : '';
    previousPlanFeatures = sanitizeFeatureList(previousConfig?.features);

    const featureComparison = buildFeatureComparison(previousPlanFeatures, newPlanFeatures);
    addedFeatures = featureComparison.addedFeatures;
    removedFeatures = featureComparison.removedFeatures;
    unchangedFeatures = featureComparison.unchangedFeatures;
  }

  return res.status(200).json({
    success: true,
    status,
    isProvisioned,
    recoveryEligible:
      Boolean(payment?.subscriptionContext?.subscriptionData?.subscriptionPlanId) &&
      !Boolean(resolvedTenantId) &&
      !Boolean(resolvedSubscriptionId),
    paymentReference: payment?.referenceNumber,
    paymentRequestId: payment?.hitpayPaymentRequestId,
    tenantId: resolvedTenantId,
    subscriptionId: resolvedSubscriptionId,
    checkoutState: status,
    apiKey,
    tenantEmail,
    companyName,
    planName,
    planPrice,
    billingPeriod,
    previousPlanName,
    previousPlanPrice,
    previousBillingPeriod,
    newPlanFeatures,
    previousPlanFeatures,
    addedFeatures,
    removedFeatures,
    unchangedFeatures,
  });
});

const getPayments = expressAsyncHandler(async (_req, res) => {
  const payments = await paymentServices.listPayments();

  return res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

export {
  createHitpayCheckout,
  getPaymentSetupStatus,
  getPayments,
};
