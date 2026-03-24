import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { initializeTenantDB, dropTenantDB } from "../../config/tenantDB.js";
import { USER_ROLES, USER_STATUS, SUBSCRIPTION_PLANS, JAF_CHATRA_COMPANY_CODE } from "../../constants/constants.js";
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
import { logger } from "../../utils/logger.js";

const RETRYABLE_ERROR_MESSAGE_FRAGMENT = "please retry your operation or multi-document transaction";

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
    status
  } = subscriptionData || {}

  const [newSubscription] = await Subscription.create(
    [
      {
        tenantId,
        subscriptionPlanId,
        subscriptionStart,
        subscriptionEnd,
        status,
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

  const {
    companyName,
    companyCode,
    subscriptionPlanId,
    subscriptionStart,
    subscriptionEnd,
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

    if (plan.name === SUBSCRIPTION_PLANS.FREE_INTERNAL && normalizedCompanyCode !== JAF_CHATRA_COMPANY_CODE) {
      throw new Error(`FREE_INTERNAL subscription plan is only available for JAF Chatra`);
    }

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
        subscriptionEnd,
        status: "ACTIVATED",
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
    } else {
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
      subscriptionEnd: formatDate(subscriptionEnd, { isIncludeTime: true }),
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