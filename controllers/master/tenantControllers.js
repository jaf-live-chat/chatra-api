import { logger } from '../../utils/logger.js';
import expressAsync from 'express-async-handler';
import tenantServices from '../../services/master/tenantServices.js';

const getTenantsByQuery = expressAsync(async (req, res) => {
  try {
    const result = await tenantServices.getTenantsByQuery(req.query);
    res.status(200).json({
      success: true,
      count: result.tenants.length,
      tenants: result.tenants,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error in getTenantsByQuery controller', { error, query: req.query });
    throw new Error('Failed to fetch tenants');
  }
});

const getSingleTenantById = expressAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await tenantServices.getSingleTenantById(id);

    res.status(200).json({
      success: true,
      tenant,
    });
  } catch (error) {
    logger.error('Error in getSingleTenantById controller', {
      error,
      tenantId: req.params?.id,
    });
    throw error;
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

const manageTenantSubscriptionById = expressAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await tenantServices.manageTenantSubscriptionById(id, req.body || {});

    res.status(200).json({
      success: true,
      message: 'Tenant subscription updated successfully.',
      tenant,
    });
  } catch (error) {
    logger.error('Error in manageTenantSubscriptionById controller', {
      error,
      tenantId: req.params?.id,
      payload: req.body,
    });
    throw error;
  }
});

const cancelTenantSubscriptionById = expressAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await tenantServices.cancelTenantSubscriptionById(id, {
      role: req.agent?.role,
      databaseName: req.auth?.databaseName,
    });

    res.status(200).json({
      success: true,
      message: 'Tenant subscription cancelled successfully. Changes are effective immediately.',
      tenant,
    });
  } catch (error) {
    logger.error('Error in cancelTenantSubscriptionById controller', {
      error,
      tenantId: req.params?.id,
      actorRole: req.agent?.role,
      actorDatabaseName: req.auth?.databaseName,
    });
    throw error;
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
  getSingleTenantById,
  updateTenantStatusById,
  manageTenantSubscriptionById,
  cancelTenantSubscriptionById,
  deleteTenantById,
}