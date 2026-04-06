import bcrypt from 'bcrypt';

import {
  STARTUP_SEED_CONFIG,
  TENANT_STATUS,
  USER_STATUS,
} from '../../constants/constants.js';
import { getMasterConnection } from '../../config/masterDB.js';
import { getTenantConnection, initializeTenantDB } from '../../config/tenantDB.js';
import { getSubscriptionPlanModel } from '../../models/master/SubscriptionPlans.js';
import databaseNameSlugger from '../../utils/databaNameSlugger.js';
import generateAPIKey from '../../utils/generateAPIKey.js';
import { logger } from '../../utils/logger.js';

const findExistingMasterAdmin = async (databaseName) => {
  const { Agents } = getTenantConnection(databaseName);
  return Agents.findOne({ role: STARTUP_SEED_CONFIG.adminRole }).lean();
};

const ensureSubscriptionPlan = async () => {
  const { connection } = getMasterConnection();
  const SubscriptionPlan = getSubscriptionPlanModel(connection);

  const plansToEnsure = [
    {
      name: STARTUP_SEED_CONFIG.planName,
      description: STARTUP_SEED_CONFIG.planDescription,
      price: 0,
      billingCycle: 'yearly',
      interval: 1,
      limits: {
        maxAgents: 999999,
        maxWebsites: 999999,
      },
      features: [
        'Analytics',
        'File Sharing',
        'Visitor Tracking',
        'Priority Support',
        'Client Support',
        'Custom Integrations',
        'Advanced Reporting',
      ],
      isPosted: false,
    },
    {
      name: 'Free',
      description: 'Free plan with limited features for testing and evaluation purposes.',
      price: 0,
      billingCycle: 'daily',
      interval: 3,
      limits: {
        maxAgents: 2,
        maxWebsites: 1,
      },
      features: [
        'Analytics',
        'File Sharing',
      ],
      isPosted: true,
    },
    {
      name: 'Starter',
      description: 'Starter plan with basic features for small businesses.',
      price: 699,
      billingCycle: 'monthly',
      interval: 1,
      limits: {
        maxAgents: 3,
        maxWebsites: 1,
      },
      features: [
        'Analytics',
        'File Sharing',
        'Visitor Tracking',
        'Priority Support',
        'Client Support',
      ],
      isPosted: true,
    },
    {
      name: 'Pro',
      description: 'Pro plan with advanced features for growing businesses.',
      price: 1999,
      billingCycle: 'monthly',
      interval: 1,
      limits: {
        maxAgents: 10,
        maxWebsites: 3,
      },
      isMostPopular: true,
      features: [
        'Analytics',
        'File Sharing',
        'Visitor Tracking',
        'Priority Support',
        'Client Support',
        'Custom Integrations',
        'Advanced Reporting',
        'API Access',
      ],
      isPosted: true,
    },
  ];

  for (const plan of plansToEnsure) {
    const existingPlan = await SubscriptionPlan.findOne({
      name: { $regex: `^${plan.name}$`, $options: 'i' },
    }).lean();

    if (!existingPlan) {
      await SubscriptionPlan.create(plan);
    }
  }

  const startupPlan = await SubscriptionPlan.findOne({
    name: { $regex: `^${STARTUP_SEED_CONFIG.planName}$`, $options: 'i' },
  });

  if (!startupPlan) {
    throw new Error('Startup seed plan could not be created.');
  }

  return startupPlan;
};

const ensureTenant = async () => {
  const { Tenant } = getMasterConnection();

  const normalizedCode = STARTUP_SEED_CONFIG.companyCode.toLowerCase();
  const existingTenant = await Tenant.findOne({
    $or: [
      { companyCode: STARTUP_SEED_CONFIG.companyCode },
      { companyCode: normalizedCode },
    ],
  });

  if (existingTenant) {
    return existingTenant;
  }

  const databaseName = databaseNameSlugger(STARTUP_SEED_CONFIG.companyName);
  await initializeTenantDB(databaseName);

  return Tenant.create({
    companyName: STARTUP_SEED_CONFIG.companyName,
    databaseName,
    companyCode: STARTUP_SEED_CONFIG.companyCode,
  });
};

const ensureSubscriptionAndApiKey = async (tenant, subscriptionPlan) => {
  const { Subscription, APIKey } = getMasterConnection();

  const subscriptionConfiguration = {
    planName: String(subscriptionPlan?.name || 'Unknown Plan'),
    price: Number(subscriptionPlan?.price || 0),
    billingCycle: String(subscriptionPlan?.billingCycle || 'monthly').toLowerCase(),
    interval: Math.max(1, Number(subscriptionPlan?.interval || 1)),
    limits: {
      maxAgents: Number(subscriptionPlan?.limits?.maxAgents || 1),
      maxWebsites: Number(subscriptionPlan?.limits?.maxWebsites || 1),
    },
    features: Array.isArray(subscriptionPlan?.features)
      ? subscriptionPlan.features.filter(Boolean).map((feature) => String(feature))
      : [],
  };

  let subscription = await Subscription.findOne({ tenantId: tenant._id }).sort({ createdAt: -1 });
  if (!subscription) {
    const subscriptionStart = new Date();

    subscription = await Subscription.create({
      tenantId: tenant._id,
      subscriptionPlanId: subscriptionPlan._id,
      subscriptionStart,
      subscriptionEnd: null,
      status: TENANT_STATUS.ACTIVATED,
      configuration: subscriptionConfiguration,
    });
  } else if (subscription.subscriptionEnd !== null) {
    subscription.subscriptionEnd = null;
    if (!subscription.configuration) {
      subscription.configuration = subscriptionConfiguration;
    }
    await subscription.save();
  }

  let apiKey = await APIKey.findOne({ tenantId: tenant._id }).sort({ createdAt: -1 });
  if (!apiKey) {
    apiKey = await APIKey.create({
      tenantId: tenant._id,
      subscriptionId: subscription._id,
      apiKey: generateAPIKey(),
    });
  }

  return { subscription, apiKey };
};

const ensureMasterAdmin = async (databaseName) => {
  const { Agents } = getTenantConnection(databaseName);

  const existingAdmin = await findExistingMasterAdmin(databaseName);
  if (existingAdmin) {
    return existingAdmin;
  }

  const hashedPassword = await bcrypt.hash(
    STARTUP_SEED_CONFIG.adminPassword,
    STARTUP_SEED_CONFIG.saltRounds
  );

  return Agents.create({
    fullName: STARTUP_SEED_CONFIG.adminFullName,
    emailAddress: STARTUP_SEED_CONFIG.adminEmail.toLowerCase(),
    password: hashedPassword,
    phoneNumber: null,
    profilePicture: null,
    status: USER_STATUS.OFFLINE,
    role: STARTUP_SEED_CONFIG.adminRole,
  });
};

export const ensureStartupSeedData = async () => {
  const { Tenant } = getMasterConnection();
  const normalizedCode = STARTUP_SEED_CONFIG.companyCode.toLowerCase();

  const existingTenant = await Tenant.findOne({
    $or: [
      { companyCode: STARTUP_SEED_CONFIG.companyCode },
      { companyCode: normalizedCode },
    ],
  });

  if (existingTenant) {
    const existingMasterAdmin = await findExistingMasterAdmin(existingTenant.databaseName);
    if (existingMasterAdmin) {
      logger.info('Startup seeding skipped because a MASTER_ADMIN already exists.');
      return { seeded: false };
    }
  }

  const plan = await ensureSubscriptionPlan();
  const tenant = await ensureTenant();
  const { apiKey } = await ensureSubscriptionAndApiKey(tenant, plan);
  const admin = await ensureMasterAdmin(tenant.databaseName);

  logger.info(`Startup seeding ensured for tenant ${tenant.companyCode}.`);
  logger.info(`MASTER_ADMIN email: ${admin.emailAddress}`);
  logger.info(`API Key: ${apiKey.apiKey}`);

  return {
    seeded: true,
    tenantId: tenant._id.toString(),
    adminId: admin._id.toString(),
    apiKey: apiKey.apiKey,
  };
};
