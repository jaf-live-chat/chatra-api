import { getTenantModel } from '../../models/master/Tenants.js';
import { getSubscriptionModel } from '../../models/master/Subscriptions.js';
import { getMasterConnection } from '../../config/masterDB.js';
import { dropTenantDB } from '../../config/tenantDB.js';
import { TENANT_STATUS } from '../../constants/constants.js';
import mongoose from 'mongoose';
import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const STATUS_LABELS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
};

const SUBSCRIPTION_ACTIONS = {
  DEACTIVATE: 'DEACTIVATE',
  ADJUST_END_DATE: 'ADJUST_END_DATE',
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

const aggregateTenantsWithSubscription = async (filter = {}, pagination = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);

  const pageNum = Math.max(1, parseInt(pagination.page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(pagination.limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
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
              _id: 1,
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
        companyCode: 1,
        databaseName: 1,
        subscription: 1,
      },
    },
    {
      $sort: { companyName: 1 },
    },
  ];

  const [tenants, totalResult] = await Promise.all([
    Tenant.aggregate([...pipeline, { $skip: skip }, { $limit: limitNum }]),
    Tenant.aggregate([...pipeline, { $count: 'total' }]),
  ]);

  const total = totalResult[0]?.total || 0;

  return {
    tenants: tenants.map((tenant) => {
      const subscription = tenant.subscription || {};

      return {
        id: String(tenant._id),
        name: tenant.companyName,
        companyCode: tenant.companyCode || '-',
        databaseName: tenant.databaseName || '-',
        subscription: {
          id: subscription?._id ? String(subscription._id) : '',
          planName: subscription.planName || '-',
          startDate: subscription.startDate || null,
          endDate: subscription.endDate || null,
          status: toLifecycleStatus(subscription),
        },
      };
    }),
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalRecords: total,
      limit: limitNum,
    },
  };
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

const getTenantsByQuery = async (query = {}) => {
  try {
    const filter = buildTenantFilter(query);

    const pagination = {
      page: query.page || 1,
      limit: query.limit || 10,
    };

    const result = await aggregateTenantsWithSubscription(filter, pagination);
    return result;

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

const manageTenantSubscriptionById = async (tenantId, payload = {}) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);

  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      throw new BadRequestError('Invalid tenant id');
    }

    const normalizedTenantId = new mongoose.Types.ObjectId(String(tenantId));
    const action = String(payload?.action || '').toUpperCase();

    if (!Object.values(SUBSCRIPTION_ACTIONS).includes(action)) {
      throw new BadRequestError('Invalid subscription action');
    }

    const latestSubscription = await Subscription.findOne({ tenantId: normalizedTenantId })
      .sort({ createdAt: -1 });

    if (!latestSubscription) {
      throw new NotFoundError('Tenant subscription not found');
    }

    if (action === SUBSCRIPTION_ACTIONS.DEACTIVATE) {
      latestSubscription.status = TENANT_STATUS.DEACTIVATED;
    }

    if (action === SUBSCRIPTION_ACTIONS.ADJUST_END_DATE) {
      const parsedDays = Number(payload?.days);

      if (!Number.isInteger(parsedDays) || parsedDays === 0) {
        throw new BadRequestError('Adjustment days must be a non-zero integer');
      }

      const currentEndDate = latestSubscription.subscriptionEnd
        ? new Date(latestSubscription.subscriptionEnd)
        : null;

      if (!currentEndDate || Number.isNaN(currentEndDate.getTime())) {
        throw new BadRequestError('Subscription end date is missing and cannot be adjusted');
      }

      const nextEndDate = addDays(currentEndDate, parsedDays);
      latestSubscription.subscriptionEnd = nextEndDate;

      if (
        latestSubscription.status === TENANT_STATUS.EXPIRED &&
        nextEndDate.getTime() >= Date.now()
      ) {
        latestSubscription.status = TENANT_STATUS.ACTIVATED;
      }
    }

    await latestSubscription.save();

    const [updatedTenant] = await aggregateTenantsWithSubscription({ _id: normalizedTenantId });
    return updatedTenant || null;
  } catch (error) {
    logger.error('Error managing tenant subscription', { error, tenantId, payload });

    if (
      error instanceof BadRequestError ||
      error instanceof NotFoundError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }

    throw new InternalServerError('Error managing tenant subscription');
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
  manageTenantSubscriptionById,
  deleteTenantById,
}