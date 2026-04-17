import { COLORS } from '../constants/colors.js';
import { DB_URI, MASTER_DB_NAME } from '../constants/constants.js';

import { getTenantModel } from '../models/master/Tenants.js';
import { getSubscriptionModel } from '../models/master/Subscriptions.js';
import { getSubscriptionPlanModel } from '../models/master/SubscriptionPlans.js';
import { getAPIKeyModel } from '../models/master/APIKeys.js';
import { getPaymentModel } from '../models/master/Payments.js';
import { getCompanyInfoModel } from '../models/master/CompanyInfo.js';

import mongoose from 'mongoose';
import { getFAQsModel } from '../models/master/FAQs.js';

let masterConnection = null;
let masterConnectPromise = null;

const masterConnectionOptions = {
  dbName: MASTER_DB_NAME,
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  waitQueueTimeoutMS: 10000,
  autoIndex: false,
};

const attachMasterConnectionListeners = (connection) => {
  if (connection.__chatraListenersAttached) {
    return;
  }

  connection.__chatraListenersAttached = true;

  connection.on('disconnected', () => {
    console.warn(COLORS.fg.red, 'Disconnected from MongoDB', COLORS.reset);
  });

  connection.on('error', (err) => {
    console.error(COLORS.fg.red, `Connection error: ${err.message}`, COLORS.reset);
  });
};

export const connectMasterDB = async () => {
  if (masterConnection && masterConnection.readyState === 1) {
    return masterConnection;
  }

  if (masterConnectPromise) {
    return masterConnectPromise;
  }

  if (!DB_URI) {
    throw new Error(
      'MongoDB URI is not set. Check MONGO_MASTER_DB_URI_LOCAL / MONGO_MASTER_DB_URI_PROD in your .env file.'
    );
  }

  masterConnectPromise = mongoose
    .connect(DB_URI, masterConnectionOptions)
    .then(() => {
      masterConnection = mongoose.connection;
      attachMasterConnectionListeners(masterConnection);

      console.log(
        COLORS.fg.green,
        `Connected => ${MASTER_DB_NAME}`,
        COLORS.reset
      );

      return masterConnection;
    })
    .catch((error) => {
      console.error(
        COLORS.fg.red,
        `Failed to connect: ${error.message}`,
        COLORS.reset
      );
      throw error;
    })
    .finally(() => {
      masterConnectPromise = null;
    });

  return masterConnectPromise;
};

export const getMasterConnection = () => {
  if (!masterConnection || masterConnection.readyState !== 1) {
    throw new Error(
      'Connection is not ready. Ensure connectMasterDB() is awaited during startup.'
    );
  }
  return {
    connection: masterConnection,
    Tenant: getTenantModel(masterConnection),
    Subscription: getSubscriptionModel(masterConnection),
    Payments: getPaymentModel(masterConnection),
    APIKey: getAPIKeyModel(masterConnection),
    SubscriptionPlan: getSubscriptionPlanModel(masterConnection),
    FAQs: getFAQsModel(masterConnection),
    CompanyInfo: getCompanyInfoModel(masterConnection),
  };
}
