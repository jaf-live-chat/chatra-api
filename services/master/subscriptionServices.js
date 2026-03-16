import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { initializeTenantDB, dropTenantDB } from "../../config/tenantDB.js";

import tenantServices from "./tenantServices.js";
import agentServices from "../tenant/agentServices.js";
import paymentServices from "./paymentServices.js";
import databaseNameSlugger from "../../utils/databaNameSlugger.js";
import generateAPIKey from "../../utils/generateAPIKey.js";

const createSubscription = async (payload, options = {}) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const { session } = options;

  const subscriptionData = payload?.subscriptionData || payload || {};

  const {
    tenantId,
    subscriptionPlan,
    subscriptionStart,
    subscriptionEnd,
    status
  } = subscriptionData || {}

  const [newSubscription] = await Subscription.create(
    [
      {
        tenantId,
        subscriptionPlan,
        subscriptionStart,
        subscriptionEnd,
        status,
      },
    ],
    session ? { session } : undefined
  );

  return newSubscription;
}

const subscribeTenantToPlan = async (payload) => {
  const subscriptionData = payload?.subscriptionData || payload || {};
  const agentData = payload?.agentData || {};
  const paymentData = payload?.paymentData || {};

  const {
    companyName,
    subscriptionPlan,
    subscriptionStart,
    subscriptionEnd,
  } = subscriptionData || {}

  const {
    fullName,
    emailAddress,
    password,
    phoneNumber,
  } = agentData || {};

  const {
    amount,
    referenceNumber,
    status: paymentStatus,
  } = paymentData || {};

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);

  let session = null;
  let useTransaction = true;
  let newTenant = null;
  let newSubscription = null;
  let newPayment = null;
  let newAgent = null;

  const databaseName = databaseNameSlugger(companyName);

  try {
    const existingTenant = await Tenant.findOne({ databaseName }).lean();
    if (existingTenant) {
      throw new Error(`Tenant already exists for company: ${companyName}`);
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
        apiKey: generateAPIKey(),
      },
      useTransaction ? { session } : {}
    );

    newSubscription = await createSubscription(
      {
        tenantId: newTenant._id,
        subscriptionPlan,
        subscriptionStart,
        subscriptionEnd,
        status: "ACTIVATED",
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
        fullName,
        emailAddress,
        password,
        phoneNumber,
      },
    });

    if (useTransaction) {
      await session.commitTransaction();
    }

    return {
      tenant: newTenant,
      subscription: newSubscription,
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