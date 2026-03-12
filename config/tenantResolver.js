import { getMasterConnection } from './masterDB.js';
import { getClientModel } from '../models/master/Client.js';
import { TENANT_CACHE_TTL_MS } from '../constants/constants.js';

const tenantInfoCache = new Map();

const tenantDbCache = new Map();

export const resolveTenant = async (apiKey) => {
  if (tenantInfoCache.has(apiKey)) {
    return tenantInfoCache.get(apiKey);
  }

  const masterConn = getMasterConnection();
  const Client = getClientModel(masterConn);

  const client = await Client.findOne({ apiKey }).lean();

  if (!client) return null;

  /** @type {TenantInfo} */
  const tenantInfo = {
    id: client._id,
    companyName: client.companyName,
    databaseName: client.databaseName,
    apiKey: client.apiKey,
    status: client.status,
    subscriptionPlan: client.subscriptionPlan,
    subscriptionStart: client.subscriptionStart,
    subscriptionEnd: client.subscriptionEnd,
  };

  tenantInfoCache.set(apiKey, tenantInfo);
  setTimeout(() => tenantInfoCache.delete(apiKey), TENANT_CACHE_TTL_MS);

  return tenantInfo;
};

export const getTenantDb = (databaseName) => {
  if (tenantDbCache.has(databaseName)) {
    return tenantDbCache.get(databaseName);
  }

  const masterConn = getMasterConnection();

  const tenantDb = masterConn.useDb(databaseName);

  tenantDbCache.set(databaseName, tenantDb);
  return tenantDb;
};

export const invalidateTenantCache = (apiKey) => {
  tenantInfoCache.delete(apiKey);
};
