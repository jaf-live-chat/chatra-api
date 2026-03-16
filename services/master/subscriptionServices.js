import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { initializeTenantDB, dropTenantDB } from "../../config/tenantDB.js";

import tenantServices from "./tenantServices.js";
import databaseNameSlugger from "../../utils/databaNameSlugger.js";

const createSubscription = async (subscriptionData, options = {}) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const { session } = options;

  const {
    tenantId,
    subscriptionPlan,
    subscriptionStart,
    subscriptionEnd,
    status
  } = subscriptionData;

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

const subscribeTenantToPlan = async ({ companyName, subscriptionPlan = "PRO" }) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);

  let session = null;
  let useTransaction = true;
  let newTenant = null;
  let newSubscription = null;

  const databaseName = databaseNameSlugger(companyName);

  try {
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
      },
      useTransaction ? { session } : {}
    );

    newSubscription = await createSubscription(
      {
        tenantId: newTenant._id,
        subscriptionPlan,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: "ACTIVATED",
      },
      useTransaction ? { session } : {}
    );

    if (useTransaction) {
      await session.commitTransaction();
    }

    return {
      tenant: newTenant,
      subscription: newSubscription,
    };
  } catch (error) {
    if (session && useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }

    if (!useTransaction) {
      if (newSubscription?._id) {
        await Subscription.deleteOne({ _id: newSubscription._id });
      }
      if (newTenant?._id) {
        await Tenant.deleteOne({ _id: newTenant._id });
      }
    }

    try {
      await dropTenantDB(databaseName);
    } catch (dropError) {
      throw new Error(`Failed to clean up tenant database after subscription failure: ${dropError.message}. Original error: ${error.message}`);
    }

  }
};

export default {
  createSubscription,
  subscribeTenantToPlan,
}