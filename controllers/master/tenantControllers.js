import { logger } from '../../utils/logger.js';
import expressAsync from 'express-async-handler';
import tenantServices from '../../services/master/tenantServices.js';

const getTenantsByQuery = expressAsync(async (req, res) => {
  try {
    const tenants = await tenantServices.getTenantsByQuery(req.query);
    res.status(200).json({
      success: true,
      count: tenants.length,
      tenants,
    });
  } catch (error) {
    logger.error('Error in getTenantsByQuery controller', { error, query: req.query });
    throw new Error('Failed to fetch tenants');
  }
});

const updateTenantStatusById = expressAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const tenant = await tenantServices.updateTenantStatusById(id, status);

    res.status(200).json({
      success: true,
      message: 'Tenant status updated successfully.',
      tenant,
    });
  } catch (error) {
    logger.error('Error in updateTenantStatusById controller', {
      error,
      tenantId: req.params?.id,
      payload: req.body,
    });
    throw new Error('Failed to update tenant status');
  }
});

const deleteTenantById = expressAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTenant = await tenantServices.deleteTenantById(id);

    res.status(200).json({
      success: true,
      message: 'Tenant deleted successfully.',
      tenant: deletedTenant,
    });
  } catch (error) {
    logger.error('Error in deleteTenantById controller', {
      error,
      tenantId: req.params?.id,
    });
    throw new Error('Failed to delete tenant');
  }
});

export {
  getTenantsByQuery,
  updateTenantStatusById,
  deleteTenantById,
}