import { getTenantModel } from '../../models/master/Tenants.js';
import { getMasterConnection } from '../../config/masterDB.js';
import { InternalServerError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const createTenant = async (tenantData, options = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const { session } = options;

  const {
    companyName,
    databaseName,
    companyCode,
  } = tenantData;

  const [newTenant] = await Tenant.create(
    [
      {
        companyName,
        companyCode,
        databaseName,
      },
    ],
    session ? { session } : undefined
  );

  return newTenant;
}

const getTenantsByQuery = async (query) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);

  try {
    const tenants = await Tenant.find(query);
    return tenants;

  } catch (error) {
    logger.error('Error fetching tenants', { error, query });
    throw new InternalServerError('Error fetching tenants', error);
  }
}

export default {
  createTenant,
  getTenantsByQuery
}