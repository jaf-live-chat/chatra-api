import { logger } from '../../utils/logger.js';
import expressAsync from 'express-async-handler';
import tenantServices from '../../services/master/tenantServices.js';

const getTenantsByQuery = expressAsync(async (req, res) => {
  try {
    const tenants = await tenantServices.getTenantsByQuery(req.query);
    res.json(tenants);
  } catch (error) {
    logger.error('Error in getTenantsByQuery controller', { error, query: req.query });
    throw new Error('Failed to fetch tenants');
  }
});

export {
  getTenantsByQuery
}