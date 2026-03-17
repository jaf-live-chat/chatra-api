import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { initializeTenantDB, dropTenantDB } from "../../config/tenantDB.js";
import { USER_ROLES, USER_STATUS, SUBSCRIPTION_PLANS, JAF_CHATRA_COMPANY_CODE } from "../../constants/constants.js";

import tenantServices from "./tenantServices.js";
import agentServices from "../tenant/agentServices.js";
import paymentServices from "./paymentServices.js";
import databaseNameSlugger from "../../utils/databaNameSlugger.js";
import generateAPIKey from "../../utils/generateAPIKey.js";
import toTitleCase from "../../utils/toTitleCase.js";

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
      throw new Error(`Tenant already exists for company: ${companyName}`);
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

    newAPIKey = await createAPIKey(
      {
        tenantId: newTenant._id,
        subscriptionId: newSubscription._id,
        apiKey: generateAPIKey(),
      },
      useTransaction ? { session } : {}
    );

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

    if (useTransaction) {
      await session.commitTransaction();
    }

    return {
      tenant: newTenant,
      subscription: newSubscription,
      apiKey: newAPIKey,
      payment: newPayment,
      agent: newAgent,
    };
  } catch (error) {
    if (session && useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }

    if (!useTransaction) {
      if (newPayment?._id) {
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