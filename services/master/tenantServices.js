import { getTenantModel } from '../../models/master/Tenants.js';
import { getSubscriptionModel } from '../../models/master/Subscriptions.js';
import { getSubscriptionPlanModel } from '../../models/master/SubscriptionPlans.js';
import { getAPIKeyModel } from '../../models/master/APIKeys.js';
import { getMasterConnection } from '../../config/masterDB.js';
import { getTenantConnection } from '../../config/tenantDB.js';
import { dropTenantDB } from '../../config/tenantDB.js';
import { TENANT_STATUS, USER_ROLES } from '../../constants/constants.js';
import calculateEndDate from '../../utils/calculateEndDate.js';
import mongoose from 'mongoose';
import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import generateAPIKey from '../../utils/generateAPIKey.js';

const STATUS_LABELS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
  SCHEDULED: 'SCHEDULED',
};

const SUBSCRIPTION_ACTIONS = {
  DEACTIVATE: 'DEACTIVATE',
  ADJUST_END_DATE: 'ADJUST_END_DATE',
  SET_END_DATE: 'SET_END_DATE',
  CHANGE_PLAN: 'CHANGE_PLAN',
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseLocalCalendarDate = (value) => {
  if (!value) return null;

  const trimmed = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, monthIndex, day);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const buildSubscriptionConfigurationFromPlan = (plan = {}) => ({
  planName: String(plan?.name || 'Unknown Plan').trim(),
  price: Number(plan?.price || 0),
  billingCycle: String(plan?.billingCycle || 'monthly').trim().toLowerCase(),
  interval: Math.max(1, Number(plan?.interval || 1)),
  limits: {
    maxAgents: Number(plan?.limits?.maxAgents || 1),
    maxWebsites: Number(plan?.limits?.maxWebsites || 1),
  },
  features: Array.isArray(plan?.features)
    ? plan.features.filter(Boolean).map((feature) => String(feature))
    : [],
});

const deactivateQueuedSubscriptions = async (Subscription, tenantId) => {
  await Subscription.updateMany(
    {
      tenantId,
      status: TENANT_STATUS.SCHEDULED,
    },
    {
      $set: { status: TENANT_STATUS.DEACTIVATED },
    }
  );
};

const getEditableSubscription = async (Subscription, tenantId) => {
  const activeSubscription = await Subscription.findOne({
    tenantId,
    status: TENANT_STATUS.ACTIVATED,
  }).sort({ createdAt: -1 });

  if (activeSubscription) {
    return activeSubscription;
  }

  return Subscription.findOne({ tenantId }).sort({ createdAt: -1 });
};

const toLifecycleStatus = (subscription = {}) => {
  const rawStatus = String(subscription?.status || '').toUpperCase();
  const endDateValue = subscription?.endDate || subscription?.subscriptionEnd;
  const endDate = endDateValue ? new Date(endDateValue) : null;


  if (
    rawStatus === TENANT_STATUS.EXPIRED ||
    (rawStatus === TENANT_STATUS.ACTIVATED && endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now())
  ) {
    return STATUS_LABELS.EXPIRED;
  }

  if (rawStatus === TENANT_STATUS.ACTIVATED) {
    return STATUS_LABELS.ACTIVE;
  }

  if (rawStatus === TENANT_STATUS.SCHEDULED) {
    return STATUS_LABELS.SCHEDULED;
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

const getTenantOwner = async (databaseName) => {
  if (!databaseName) {
    return null;
  }

  const { Agents } = getTenantConnection(databaseName);

  const ownerAgent = await Agents.findOne(
    { role: USER_ROLES.ADMIN.value },
    { fullName: 1, emailAddress: 1 }
  )
    .sort({ createdAt: 1 })
    .lean();

  if (!ownerAgent) {
    return null;
  }

  return {
    name: ownerAgent.fullName || '',
    email: ownerAgent.emailAddress || '',
  };
};

const mapTenantWithSubscription = (tenant = {}) => {
  const subscription = tenant.subscription || {};
  const upcomingSubscription = tenant.upcomingSubscription || {};

  const activeSubscription = subscription?._id ? {
    id: String(subscription._id),
    planId: subscription?.planId ? String(subscription.planId) : '',
    planName: subscription.planName || '-',
    startDate: subscription.startDate || null,
    endDate: subscription.endDate || null,
    status: toLifecycleStatus(subscription),
    configuration: subscription.configuration || null,
  } : null;

  const pendingSubscription = upcomingSubscription?._id ? {
    id: String(upcomingSubscription._id),
    planId: upcomingSubscription?.planId ? String(upcomingSubscription.planId) : '',
    planName: upcomingSubscription.planName || '-',
    startDate: upcomingSubscription.startDate || null,
    endDate: upcomingSubscription.endDate || null,
    status: toLifecycleStatus({
      ...upcomingSubscription,
      status: upcomingSubscription.status || TENANT_STATUS.SCHEDULED,
    }),
    configuration: upcomingSubscription.configuration || null,
  } : null;

  return {
    id: String(tenant._id),
    name: tenant.companyName,
    companyCode: tenant.companyCode || '-',
    databaseName: tenant.databaseName || '-',
    subscription: activeSubscription || {
      id: '',
      planId: '',
      planName: '-',
      startDate: null,
      endDate: null,
      status: STATUS_LABELS.INACTIVE,
      configuration: null,
    },
    upcomingSubscription: pendingSubscription,
    activeSubscription,
    pendingSubscription,
  };
};

const buildTenantWithSubscriptionPipeline = (filter = {}) => {
  return [
    { $match: filter },
    {
      $lookup: {
        from: 'subscriptions',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tenantId', '$$tenantId'] },
              status: { $ne: TENANT_STATUS.SCHEDULED },
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
              planId: '$subscriptionPlanId',
              planName: { $ifNull: ['$configuration.planName', '$plan.name'] },
              startDate: '$subscriptionStart',
              endDate: '$subscriptionEnd',
              status: '$status',
              configuration: '$configuration',
            },
          },
        ],
        as: 'subscription',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tenantId', '$$tenantId'] },
              status: TENANT_STATUS.SCHEDULED,
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
              planId: '$subscriptionPlanId',
              planName: { $ifNull: ['$configuration.planName', '$plan.name'] },
              startDate: '$subscriptionStart',
              endDate: '$subscriptionEnd',
              status: '$status',
              configuration: '$configuration',
            },
          },
        ],
        as: 'upcomingSubscription',
      },
    },
    {
      $unwind: {
        path: '$subscription',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$upcomingSubscription',
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
        upcomingSubscription: 1,
      },
    },
    {
      $sort: { companyName: 1 },
    },
  ];
};

const aggregateTenantsWithSubscription = async (filter = {}, pagination = {}) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);

  const pageNum = Math.max(1, parseInt(pagination.page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(pagination.limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const pipeline = buildTenantWithSubscriptionPipeline(filter);

  const [tenants, totalResult] = await Promise.all([
    Tenant.aggregate([...pipeline, { $skip: skip }, { $limit: limitNum }]),
    Tenant.aggregate([...pipeline, { $count: 'total' }]),
  ]);

  const total = totalResult[0]?.total || 0;

  return {
    tenants: tenants.map(mapTenantWithSubscription),
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalRecords: total,
      limit: limitNum,
    },
  };
};

const syncTenantSubscriptionLifecycle = async (tenantId) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const APIKey = getAPIKeyModel(connection);

  const activeSubscription = await Subscription.findOne({
    tenantId,
    status: TENANT_STATUS.ACTIVATED,
  }).sort({ createdAt: -1 });

  const scheduledSubscription = await Subscription.findOne({
    tenantId,
    status: TENANT_STATUS.SCHEDULED,
  }).sort({ createdAt: -1 });

  const now = Date.now();
  const activeEndDate = activeSubscription?.subscriptionEnd ? new Date(activeSubscription.subscriptionEnd) : null;
  const scheduledStartDate = scheduledSubscription?.subscriptionStart ? new Date(scheduledSubscription.subscriptionStart) : null;

  if (activeSubscription && activeEndDate && !Number.isNaN(activeEndDate.getTime()) && activeEndDate.getTime() <= now) {
    activeSubscription.status = TENANT_STATUS.EXPIRED;
    await activeSubscription.save();
  }

  if (scheduledSubscription && scheduledStartDate && !Number.isNaN(scheduledStartDate.getTime()) && scheduledStartDate.getTime() <= now) {
    if (activeSubscription && activeSubscription._id.toString() !== scheduledSubscription._id.toString()) {
      activeSubscription.status = TENANT_STATUS.EXPIRED;
      await activeSubscription.save();
    }

    scheduledSubscription.status = TENANT_STATUS.ACTIVATED;
    await scheduledSubscription.save();

    const existingApiKey = await APIKey.findOne({
      tenantId,
      subscriptionId: scheduledSubscription._id,
    }).lean();

    if (!existingApiKey) {
      await APIKey.create({
        tenantId,
        subscriptionId: scheduledSubscription._id,
        apiKey: generateAPIKey(),
      });
    }
  }
};

const syncDueTenantSubscriptions = async () => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);

  const dueTenantIds = await Subscription.distinct('tenantId', {
    status: TENANT_STATUS.SCHEDULED,
    subscriptionStart: { $lte: new Date() },
    tenantId: { $ne: null },
  });

  for (const tenantId of dueTenantIds) {
    await syncTenantSubscriptionLifecycle(tenantId);
  }
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

const getSingleTenantById = async (tenantId) => {
  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);
  const SubscriptionPlan = getSubscriptionPlanModel(connection);

  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      throw new BadRequestError('Invalid tenant id');
    }

    const normalizedTenantId = new mongoose.Types.ObjectId(String(tenantId));
    await syncTenantSubscriptionLifecycle(normalizedTenantId);
    const pipeline = buildTenantWithSubscriptionPipeline({ _id: normalizedTenantId });

    const [tenant] = await Tenant.aggregate(pipeline);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const upcomingSubscription = await Subscription.findOne({
      tenantId: normalizedTenantId,
      status: TENANT_STATUS.SCHEDULED,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (upcomingSubscription) {
      const upcomingPlan = await SubscriptionPlan.findById(upcomingSubscription.subscriptionPlanId).lean();
      tenant.upcomingSubscription = {
        _id: upcomingSubscription._id,
        planId: upcomingSubscription.subscriptionPlanId,
        planName: upcomingSubscription?.configuration?.planName || upcomingPlan?.name || '-',
        startDate: upcomingSubscription.subscriptionStart,
        endDate: upcomingSubscription.subscriptionEnd,
        status: upcomingSubscription.status,
        configuration: upcomingSubscription.configuration || null,
      };
    }

    const mappedTenant = mapTenantWithSubscription(tenant);
    const owner = await getTenantOwner(mappedTenant.databaseName);

    return {
      ...mappedTenant,
      owner,
    };
  } catch (error) {
    logger.error('Error fetching single tenant', { error, tenantId });

    if (
      error instanceof BadRequestError ||
      error instanceof NotFoundError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }

    throw new InternalServerError('Error fetching tenant details');
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

    const updatedResult = await aggregateTenantsWithSubscription({ _id: normalizedTenantId });
    return updatedResult.tenants?.[0] || null;
  } catch (error) {
    logger.error('Error updating tenant status', { error, tenantId, status });
    throw new InternalServerError('Error updating tenant status', error);
  }
}

const manageTenantSubscriptionById = async (tenantId, payload = {}) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const SubscriptionPlan = getSubscriptionPlanModel(connection);

  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      throw new BadRequestError('Invalid tenant id');
    }

    const normalizedTenantId = new mongoose.Types.ObjectId(String(tenantId));
    const action = String(payload?.action || '').toUpperCase();

    if (!Object.values(SUBSCRIPTION_ACTIONS).includes(action)) {
      throw new BadRequestError('Invalid subscription action');
    }

    const latestSubscription = await getEditableSubscription(Subscription, normalizedTenantId);
    const subscriptionUpdates = {};

    if (!latestSubscription) {
      throw new NotFoundError('Tenant subscription not found');
    }

    if (action === SUBSCRIPTION_ACTIONS.DEACTIVATE) {
      subscriptionUpdates.status = TENANT_STATUS.DEACTIVATED;
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
      subscriptionUpdates.subscriptionEnd = nextEndDate;

      if (
        latestSubscription.status === TENANT_STATUS.EXPIRED &&
        nextEndDate.getTime() >= Date.now()
      ) {
        subscriptionUpdates.status = TENANT_STATUS.ACTIVATED;
      }
    }

    if (action === SUBSCRIPTION_ACTIONS.SET_END_DATE) {
      const targetEndDate = parseLocalCalendarDate(payload?.endDate);

      if (!targetEndDate || Number.isNaN(targetEndDate.getTime())) {
        throw new BadRequestError('endDate must be a valid date');
      }

      subscriptionUpdates.subscriptionEnd = targetEndDate;

      if (
        latestSubscription.status === TENANT_STATUS.EXPIRED &&
        targetEndDate.getTime() >= Date.now()
      ) {
        subscriptionUpdates.status = TENANT_STATUS.ACTIVATED;
      }

      if (latestSubscription.status === TENANT_STATUS.ACTIVATED && targetEndDate.getTime() < Date.now()) {
        subscriptionUpdates.status = TENANT_STATUS.EXPIRED;
      }
    }

    if (action === SUBSCRIPTION_ACTIONS.CHANGE_PLAN) {
      const subscriptionPlanId = String(payload?.subscriptionPlanId || '').trim();

      if (!subscriptionPlanId) {
        throw new BadRequestError('subscriptionPlanId is required');
      }

      if (!mongoose.Types.ObjectId.isValid(subscriptionPlanId)) {
        throw new BadRequestError('subscriptionPlanId must be a valid Mongo ObjectId');
      }

      const plan = await SubscriptionPlan.findById(subscriptionPlanId).lean();

      if (!plan) {
        throw new NotFoundError('Subscription plan not found');
      }

      const now = new Date();

      await deactivateQueuedSubscriptions(Subscription, normalizedTenantId);

      await Subscription.updateMany(
        {
          tenantId: normalizedTenantId,
          status: TENANT_STATUS.ACTIVATED,
          _id: { $ne: latestSubscription._id },
        },
        {
          $set: {
            status: TENANT_STATUS.EXPIRED,
            subscriptionEnd: now,
          },
        }
      );

      subscriptionUpdates.subscriptionPlanId = plan._id;
      subscriptionUpdates.subscriptionStart = now;
      subscriptionUpdates.subscriptionEnd = calculateEndDate(
        now,
        plan?.billingCycle || 'monthly',
        plan?.interval || 1
      );
      subscriptionUpdates.status = TENANT_STATUS.ACTIVATED;
      subscriptionUpdates.configuration = buildSubscriptionConfigurationFromPlan(plan);
    }

    const updatedSubscription = await Subscription.findOneAndUpdate(
      { _id: latestSubscription._id },
      { $set: subscriptionUpdates },
      { new: true }
    );

    if (!updatedSubscription) {
      throw new InternalServerError('Failed to update tenant subscription');
    }

    const updatedResult = await aggregateTenantsWithSubscription({ _id: normalizedTenantId });
    return updatedResult.tenants?.[0] || null;
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
  getSingleTenantById,
  updateTenantStatusById,
  manageTenantSubscriptionById,
  deleteTenantById,
  syncDueTenantSubscriptions,
}