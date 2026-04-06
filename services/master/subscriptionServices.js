import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { initializeTenantDB, dropTenantDB, getTenantConnection } from "../../config/tenantDB.js";
import { USER_ROLES, USER_STATUS, STARTUP_SEED_CONFIG, TENANT_STATUS } from "../../constants/constants.js";
import { formatDate } from "../../utils/dateFormatter.js";

import tenantServices from "./tenantServices.js";
import agentServices from "../tenant/agentServices.js";
import paymentServices from "./paymentServices.js";
import databaseNameSlugger from "../../utils/databaNameSlugger.js";
import generateAPIKey from "../../utils/generateAPIKey.js";
import toTitleCase from "../../utils/toTitleCase.js";
import emailService from "../../utils/emailService.js";
import baseEmailTemplate from "../../templates/base-email/baseEmail.js";
import subscribeEmailTemplate from "../../templates/subscriptions/SubscribeEmail.js";
import planChangeEmailTemplate from "../../templates/subscriptions/planChangeEmail.js";
import { logger } from "../../utils/logger.js";
import calculateEndDate from "../../utils/calculateEndDate.js";

const RETRYABLE_ERROR_MESSAGE_FRAGMENT = "please retry your operation or multi-document transaction";
const normalizeText = (value) => String(value || "").trim().toLowerCase();
const isInternalPlan = (plan) => normalizeText(plan?.name) === normalizeText(STARTUP_SEED_CONFIG.planName);

const isRetryableMongoError = (error) => {
  const labels = error?.errorLabels || [];
  const message = String(error?.message || "").toLowerCase();

  return (
    labels.includes("TransientTransactionError") ||
    labels.includes("UnknownTransactionCommitResult") ||
    message.includes(RETRYABLE_ERROR_MESSAGE_FRAGMENT)
  );
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isDateValid = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const buildSubscriptionConfigurationFromPlan = (plan = {}) => {
  return {
    planName: String(plan?.name || "Unknown Plan").trim(),
    price: Number(plan?.price || 0),
    billingCycle: String(plan?.billingCycle || "monthly").trim().toLowerCase(),
    interval: Math.max(1, Number(plan?.interval || 1)),
    limits: {
      maxAgents: Number(plan?.limits?.maxAgents || 1),
      maxWebsites: Number(plan?.limits?.maxWebsites || 1),
    },
    features: Array.isArray(plan?.features)
      ? plan.features.filter(Boolean).map((feature) => String(feature))
      : [],
  };
};

const getTenantNotificationDetails = async (tenantId) => {
  if (!tenantId) {
    return {
      tenantEmail: "",
      companyName: "",
    };
  }

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const tenant = await Tenant.findById(tenantId).lean();

  if (!tenant?.databaseName) {
    return {
      tenantEmail: "",
      companyName: tenant?.companyName || "",
    };
  }

  const { Agents } = getTenantConnection(tenant.databaseName);
  const adminAgent = await Agents.findOne({}, { emailAddress: 1 })
    .sort({ createdAt: 1 })
    .lean();

  return {
    tenantEmail: adminAgent?.emailAddress || "",
    companyName: tenant?.companyName || "",
  };
};

const deactivateQueuedSubscriptions = async (Subscription, tenantId) => {
  await Subscription.updateMany(
    {
      tenantId,
      status: TENANT_STATUS.SCHEDULED,
    },
    {
      $set: { status: TENANT_STATUS.DEACTIVATED },
    }
  );
};

const queueTenantPlanChange = async (payload) => {
  const subscriptionData = payload?.subscriptionData || payload || {};
  const paymentData = payload?.paymentData || {};
  const {
    tenantId,
    subscriptionPlanId,
  } = subscriptionData || {};

  const {
    amount,
    referenceNumber,
    status: paymentStatus,
    existingPaymentId,
  } = paymentData || {};

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);
  const { SubscriptionPlan } = getMasterConnection();

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    throw new Error(`Tenant with ID '${tenantId}' not found`);
  }

  const plan = await SubscriptionPlan.findOne({ _id: subscriptionPlanId }).lean();
  if (!plan) {
    throw new Error(`Subscription plan with ID '${subscriptionPlanId}' not found`);
  }

  const currentActiveSubscription = await Subscription.findOne({
    tenantId,
    status: TENANT_STATUS.ACTIVATED,
  })
    .sort({ subscriptionEnd: -1, createdAt: -1 })
    .lean();

  const now = new Date();
  const currentEndDate = currentActiveSubscription?.subscriptionEnd
    ? new Date(currentActiveSubscription.subscriptionEnd)
    : null;

  const activationStart = currentEndDate && isDateValid(currentEndDate) && currentEndDate.getTime() > now.getTime()
    ? currentEndDate
    : now;

  const activationStatus = activationStart.getTime() > now.getTime()
    ? TENANT_STATUS.SCHEDULED
    : TENANT_STATUS.ACTIVATED;

  await deactivateQueuedSubscriptions(Subscription, tenantId);

  if (currentActiveSubscription && currentEndDate && isDateValid(currentEndDate) && currentEndDate.getTime() <= now.getTime()) {
    await Subscription.updateOne(
      { _id: currentActiveSubscription._id },
      { $set: { status: TENANT_STATUS.EXPIRED } }
    );
  }

  if (currentActiveSubscription && activationStatus === TENANT_STATUS.ACTIVATED) {
    await Subscription.updateOne(
      { _id: currentActiveSubscription._id },
      { $set: { status: TENANT_STATUS.EXPIRED } }
    );
  }

  const subscriptionEnd = calculateEndDate(
    activationStart,
    plan?.billingCycle || "monthly",
    plan?.interval || 1
  );
  const configuration = buildSubscriptionConfigurationFromPlan(plan);

  const [newSubscription] = await Subscription.create([
    {
      tenantId,
      subscriptionPlanId: plan._id,
      subscriptionStart: activationStart,
      subscriptionEnd,
      status: activationStatus,
      configuration,
    },
  ]);

  const subscriptionApiKey = await ensureAPIKey({
    tenantId,
    subscriptionId: newSubscription._id,
    apiKey: generateAPIKey(),
  });

  const notificationDetails = await getTenantNotificationDetails(tenantId);
  const recipientEmail = notificationDetails.tenantEmail;
  const currentPlanName = "Current Plan";
  const nextPlanPrice = plan.price === 0 ? "Free" : `₱${plan.price}`;

  if (recipientEmail) {
    const effectiveDateLabel = formatDate(activationStart, { isIncludeTime: true });
    const nextBillingDateLabel = formatDate(subscriptionEnd, { isIncludeTime: true });

    try {
      await emailService.sendEmail({
        to: recipientEmail,
        subject: `Your ${toTitleCase(notificationDetails.companyName || tenant.companyName)} plan change is scheduled`,
        html: baseEmailTemplate(
          planChangeEmailTemplate({
            adminName: notificationDetails.companyName || tenant.companyName,
            companyName: notificationDetails.companyName || tenant.companyName,
            currentPlanName,
            nextPlanName: plan.name,
            nextPlanPrice,
            effectiveDate: effectiveDateLabel,
            nextBillingDate: nextBillingDateLabel,
          })
        ),
      });
    } catch (emailError) {
      logger.warn(`Failed to send plan change email for tenant ${tenantId}: ${emailError.message}`);
    }
  }

  return {
    tenant,
    subscription: newSubscription,
    apiKey: subscriptionApiKey,
    payment: existingPaymentId ? {
      _id: existingPaymentId,
      amount,
      referenceNumber,
      status: paymentStatus,
    } : null,
    agent: null,
    upcomingSubscription: newSubscription,
  };
};

const withMongoRetry = async (operation, config = {}) => {
  const {
    maxAttempts = 3,
    delayMs = 150,
    operationName = "mongo-operation",
  } = config;

  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableMongoError(error) || attempt >= maxAttempts) {
        throw error;
      }

      logger.warn(
        `${operationName} transient failure on attempt ${attempt}/${maxAttempts}: ${error.message}`
      );
      await wait(delayMs * attempt);
    }
  }

  throw lastError;
};

const createSubscription = async (payload, options = {}) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const { session } = options;

  const subscriptionData = payload?.subscriptionData || payload || {};

  const {
    tenantId,
    subscriptionPlanId,
    subscriptionStart,
    subscriptionEnd,
    status,
    configuration,
  } = subscriptionData || {}

  const [newSubscription] = await Subscription.create(
    [
      {
        tenantId,
        subscriptionPlanId,
        subscriptionStart,
        subscriptionEnd,
        status,
        configuration,
      },
    ],
    session ? { session } : undefined
  );

  return newSubscription;
}

const createAPIKey = async (payload, options = {}) => {
  const { APIKey } = getMasterConnection()
  const { session } = options;

  const apiKeyData = payload?.apiKeyData || payload || {};
  const {
    tenantId,
    subscriptionId,
    apiKey,
  } = apiKeyData;

  const [newAPIKey] = await APIKey.create(
    [
      {
        tenantId,
        subscriptionId,
        apiKey,
      },
    ],
    session ? { session } : undefined
  );

  return newAPIKey;
}

const ensureAPIKey = async (payload, options = {}) => {
  const { APIKey } = getMasterConnection();
  const { session } = options;

  const apiKeyData = payload?.apiKeyData || payload || {};
  const {
    tenantId,
    subscriptionId,
    apiKey,
  } = apiKeyData;

  const existing = await APIKey.findOne({ tenantId, subscriptionId }).lean();
  if (existing) {
    return existing;
  }

  let generatedKey = apiKey;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await createAPIKey(
        {
          tenantId,
          subscriptionId,
          apiKey: generatedKey || generateAPIKey(),
        },
        session ? { session } : {}
      );
    } catch (error) {
      lastError = error;
      const isDuplicateKeyError = Number(error?.code) === 11000;
      if (!isDuplicateKeyError || attempt === 3) {
        throw error;
      }

      generatedKey = generateAPIKey();
    }
  }

  throw lastError;
};

const subscribeTenantToPlan = async (payload) => {
  const subscriptionData = payload?.subscriptionData || payload || {};
  const agentData = payload?.agentData || {};
  const paymentData = payload?.paymentData || {};
  const shouldCreatePaymentRecord = payload?.shouldCreatePaymentRecord !== false;

  if (subscriptionData?.tenantId) {
    return queueTenantPlanChange({
      subscriptionData,
      paymentData,
    });
  }

  const {
    companyName,
    companyCode,
    subscriptionPlanId,
    subscriptionStart,
  } = subscriptionData || {}

  const {
    fullName,
    emailAddress,
    password,
    phoneNumber,
    role
  } = agentData || {};

  const {
    amount,
    referenceNumber,
    status: paymentStatus,
    existingPaymentId,
  } = paymentData || {};

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);
  const { APIKey, SubscriptionPlan } = getMasterConnection();

  let session = null;
  let useTransaction = true;
  let newTenant = null;
  let newSubscription = null;
  let newAPIKey = null;
  let newPayment = null;
  let newAgent = null;
  let didCreatePaymentInThisFlow = false;

  const databaseName = databaseNameSlugger(companyName);

  try {
    const normalizedCompanyCode = String(companyCode || "").trim().toLowerCase();

    const existingTenant = await Tenant.findOne({
      $or: [
        { databaseName },
        { companyCode: normalizedCompanyCode },
      ],
    }).lean();
    if (existingTenant) {
      if (!existingPaymentId) {
        throw new Error(`Tenant already exists for company: ${companyName}`);
      }

      const existingSubscription = await Subscription.findOne({
        tenantId: existingTenant._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!existingSubscription) {
        throw new Error(`Tenant exists but no subscription was found for company: ${companyName}`);
      }

      const recoveredAPIKey = await ensureAPIKey({
        tenantId: existingTenant._id,
        subscriptionId: existingSubscription._id,
        apiKey: generateAPIKey(),
      });

      return {
        tenant: existingTenant,
        subscription: existingSubscription,
        apiKey: recoveredAPIKey,
        payment: {
          _id: existingPaymentId,
          amount,
          referenceNumber,
          status: paymentStatus,
        },
        agent: null,
      };
    }

    const plan = await SubscriptionPlan.findOne({ _id: subscriptionPlanId }).lean();
    if (!plan) {
      throw new Error(`Subscription plan with ID '${subscriptionPlanId}' not found`);
    }

    if (isInternalPlan(plan)) {
      const existingInternalSubscription = await Subscription.findOne({
        subscriptionPlanId: plan._id,
      }).lean();

      if (existingInternalSubscription) {
        throw new Error("Internal plan already has an active subscriber");
      }
    }

    const resolvedSubscriptionEnd = calculateEndDate(
      subscriptionStart,
      plan?.billingCycle || "monthly",
      plan?.interval || 1
    );

    await initializeTenantDB(databaseName);

    session = await connection.startSession();

    try {
      session.startTransaction();
    } catch (transactionError) {
      useTransaction = false;
    }

    newTenant = await tenantServices.createTenant(
      {
        companyName,
        databaseName,
        companyCode: normalizedCompanyCode,
      },
      useTransaction ? { session } : {}
    );

    newSubscription = await createSubscription(
      {
        tenantId: newTenant._id,
        subscriptionPlanId: plan._id,
        subscriptionStart,
        subscriptionEnd: resolvedSubscriptionEnd,
        status: "ACTIVATED",
        configuration: buildSubscriptionConfigurationFromPlan(plan),
      },
      useTransaction ? { session } : {}
    );

    newAPIKey = await withMongoRetry(
      () => ensureAPIKey(
        {
          tenantId: newTenant._id,
          subscriptionId: newSubscription._id,
          apiKey: generateAPIKey(),
        },
        useTransaction ? { session } : {}
      ),
      { operationName: "create-api-key" }
    );

    if (existingPaymentId) {
      newPayment = {
        _id: existingPaymentId,
        amount,
        referenceNumber,
        status: paymentStatus,
      };
    } else if (shouldCreatePaymentRecord) {
      newPayment = await paymentServices.createPayment(
        {
          tenantId: newTenant._id,
          subscriptionId: newSubscription._id,
          amount,
          referenceNumber,
          status: paymentStatus,
        },
        useTransaction ? { session } : {}
      );
      didCreatePaymentInThisFlow = true;
    } else {
      newPayment = null;
    }

    newAgent = await agentServices.createAgent({
      databaseName,
      agentData: {
        fullName: toTitleCase(fullName),
        emailAddress,
        password,
        phoneNumber,
        status: USER_STATUS.AVAILABLE,
        role: role || USER_ROLES.ADMIN.value,
      },
    });

    const emailBody = subscribeEmailTemplate({
      adminName: fullName,
      companyName,
      planName: plan.name,
      planPrice: plan.price,
      subscriptionStart: formatDate(subscriptionStart, { isIncludeTime: true }),
      subscriptionEnd: formatDate(resolvedSubscriptionEnd, { isIncludeTime: true }),
      apiKey: newAPIKey.apiKey
    })

    if (useTransaction) {
      await withMongoRetry(
        () => session.commitTransaction(),
        { operationName: "commit-subscription-transaction" }
      );
      await emailService.sendEmail({
        to: emailAddress,
        subject: `Welcome to ${toTitleCase(companyName)}! Your subscription to ${toTitleCase(plan.name)} plan is confirmed`,
        html: baseEmailTemplate(emailBody)
      })
    }

    return {
      tenant: newTenant,
      subscription: newSubscription,
      apiKey: newAPIKey,
      payment: newPayment,
      agent: newAgent,
    };
  } catch (error) {
    if (existingPaymentId && newTenant?._id && newSubscription?._id && !newAPIKey?._id) {
      try {
        const [tenantExists, subscriptionExists] = await Promise.all([
          Tenant.exists({ _id: newTenant._id }),
          Subscription.exists({ _id: newSubscription._id }),
        ]);

        if (tenantExists && subscriptionExists) {
          newAPIKey = await ensureAPIKey({
            tenantId: newTenant._id,
            subscriptionId: newSubscription._id,
            apiKey: generateAPIKey(),
          });
          logger.warn(
            `Recovered missing API key after provisioning error for tenant ${newTenant._id}`
          );
        }
      } catch (recoveryError) {
        logger.error(`API key recovery failed: ${recoveryError.message}`);
      }
    }

    if (session && useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }

    if (!useTransaction) {
      if (didCreatePaymentInThisFlow && newPayment?._id) {
        await paymentServices.deletePaymentById(newPayment._id);
      }
      if (newAPIKey?._id) {
        await APIKey.deleteOne({ _id: newAPIKey._id });
      }
      if (newSubscription?._id) {
        await Subscription.deleteOne({ _id: newSubscription._id });
      }
      if (newTenant?._id) {
        await Tenant.deleteOne({ _id: newTenant._id });
      }
    }

    if (newTenant?._id) {
      try {
        await dropTenantDB(databaseName);
      } catch (dropError) {
        throw new Error(`Failed to clean up tenant database after subscription failure: ${dropError.message}. Original error: ${error.message}`);
      }
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export default {
  createSubscription,
  subscribeTenantToPlan,
}