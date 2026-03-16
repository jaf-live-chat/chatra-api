import { getTenantModel } from '../../models/master/Tenants.js';
import { getMasterConnection } from '../../config/masterDB.js';

const createTenant = async (tenantData, options = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const { session } = options;

  const {
    companyName,
    databaseName,
    companyCode,
    apiKey,
  } = tenantData;

  const [newTenant] = await Tenant.create(
    [
      {
        companyName,
        companyCode,
        apiKey,
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