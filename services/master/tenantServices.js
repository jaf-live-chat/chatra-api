import { getTenantModel } from '../../models/master/Tenants.js';
import { getMasterConnection } from '../../config/masterDB.js';

const createTenant = async (tenantData, options = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const { session } = options;

  const {
    companyName,
    databaseName,
  } = tenantData;

  const [newTenant] = await Tenant.create(
    [
      {
        companyName,
        apiKey: Math.random().toString(36).substring(2, 15),
        databaseName,
      },
    ],
    session ? { session } : undefined
  );

  return newTenant;
}

export default {
  createTenant
}