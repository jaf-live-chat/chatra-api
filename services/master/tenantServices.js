import { getTenantModel } from '../../models/master/Tenants.js';
import { getSubscriptionModel } from '../../models/master/Subscriptions.js';
import { getMasterConnection } from '../../config/masterDB.js';
import { dropTenantDB } from '../../config/tenantDB.js';
import { TENANT_STATUS } from '../../constants/constants.js';
import mongoose from 'mongoose';
import { InternalServerError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const STATUS_LABELS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
};

const toLifecycleStatus = (subscription = {}) => {
  const rawStatus = String(subscription?.status || '').toUpperCase();
  const endDateValue = subscription?.endDate || subscription?.subscriptionEnd;
  const endDate = endDateValue ? new Date(endDateValue) : null;

  if (
    rawStatus === TENANT_STATUS.EXPIRED ||
    (endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now())
  ) {
    return STATUS_LABELS.EXPIRED;
  }

  if (rawStatus === TENANT_STATUS.ACTIVATED) {
    return STATUS_LABELS.ACTIVE;
  }

  return STATUS_LABELS.INACTIVE;
};

const toMasterStatus = (status) => {
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus === STATUS_LABELS.ACTIVE) {
    return TENANT_STATUS.ACTIVATED;
  }

  if (normalizedStatus === STATUS_LABELS.EXPIRED) {
    return TENANT_STATUS.EXPIRED;
  }

  return TENANT_STATUS.DEACTIVATED;
};

const buildTenantFilter = (query = {}) => {
  const filter = {};

  if (query._id && mongoose.Types.ObjectId.isValid(String(query._id))) {
    filter._id = new mongoose.Types.ObjectId(String(query._id));
  }

  if (query.name) {
    filter.companyName = { $regex: String(query.name).trim(), $options: 'i' };
  }

  if (query.companyCode) {
    filter.companyCode = String(query.companyCode).trim().toLowerCase();
  }

  return filter;
};

const aggregateTenantsWithSubscription = async (filter = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);

  const tenants = await Tenant.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'subscriptions',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tenantId', '$$tenantId'] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: 'subscriptionplans',
              localField: 'subscriptionPlanId',
              foreignField: '_id',
              as: 'plan',
            },
          },
          {
            $unwind: {
              path: '$plan',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 0,
              planName: '$plan.name',
              startDate: '$subscriptionStart',
              endDate: '$subscriptionEnd',
              status: '$status',
            },
          },
        ],
        as: 'subscription',
      },
    },
    {
      $unwind: {
        path: '$subscription',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        companyName: 1,
        subscription: 1,
      },
    },
    {
      $sort: { companyName: 1 },
    },
  ]);

  return tenants.map((tenant) => {
    const subscription = tenant.subscription || {};

    return {
      id: String(tenant._id),
      name: tenant.companyName,
      subscription: {
        planName: subscription.planName || '-',
        startDate: subscription.startDate || null,
        endDate: subscription.endDate || null,
        status: toLifecycleStatus(subscription),
      },
    };
  });
};

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
  try {
    const filter = buildTenantFilter(query);
    const tenants = await aggregateTenantsWithSubscription(filter);
    return tenants;

  } catch (error) {
    logger.error('Error fetching tenants', { error, query });
    throw new InternalServerError('Error fetching tenants', error);
  }
}

const updateTenantStatusById = async (tenantId, status) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);

  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      throw new InternalServerError('Invalid tenant id');
    }

    const normalizedTenantId = new mongoose.Types.ObjectId(String(tenantId));

    const latestSubscription = await Subscription.findOne({ tenantId: normalizedTenantId })
      .sort({ createdAt: -1 });

    if (!latestSubscription) {
      throw new InternalServerError('Tenant subscription not found');
    }

    latestSubscription.status = toMasterStatus(status);
    await latestSubscription.save();

    const [updatedTenant] = await aggregateTenantsWithSubscription({ _id: normalizedTenantId });
    return updatedTenant || null;
  } catch (error) {
    logger.error('Error updating tenant status', { error, tenantId, status });
    throw new InternalServerError('Error updating tenant status', error);
  }
}

const deleteTenantById = async (tenantId) => {
  const { connection, APIKey, Payments } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);

  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      throw new InternalServerError('Invalid tenant id');
    }

    const normalizedTenantId = new mongoose.Types.ObjectId(String(tenantId));

    const tenant = await Tenant.findById(normalizedTenantId);
    if (!tenant) {
      throw new InternalServerError('Tenant not found');
    }

    await Promise.all([
      Subscription.deleteMany({ tenantId: normalizedTenantId }),
      APIKey.deleteMany({ tenantId: normalizedTenantId }),
      Payments.deleteMany({ tenantId: normalizedTenantId }),
      Tenant.deleteOne({ _id: normalizedTenantId }),
    ]);

    if (tenant.databaseName) {
      try {
        await dropTenantDB(tenant.databaseName);
      } catch (dropError) {
        logger.warn('Tenant DB drop failed after tenant deletion', {
          tenantId,
          databaseName: tenant.databaseName,
          error: dropError,
        });
      }
    }

    return { id: String(tenant._id), name: tenant.companyName };
  } catch (error) {
    logger.error('Error deleting tenant', { error, tenantId });
    throw new InternalServerError('Error deleting tenant', error);
  }
}

export default {
  createTenant,
  getTenantsByQuery,
  updateTenantStatusById,
  deleteTenantById,
}