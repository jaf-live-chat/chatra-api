import dotenv from "dotenv";
dotenv.config();

import { connectMasterDB, getMasterConnection } from "../config/masterDB.js";
import { initializeTenantDB, getTenantConnection } from "../config/tenantDB.js";
import { getSubscriptionPlanModel } from "../models/master/SubscriptionPlans.js";
import { getTenantModel } from "../models/master/Tenants.js";
import { getAgentModel } from "../models/tenant/Agents.js";
import { getSubscriptionModel } from "../models/master/Subscriptions.js";
import bcrypt from "bcrypt";
import databaseNameSlugger from "../utils/databaNameSlugger.js";
import {
  SUBSCRIPTION_PLANS,
  JAF_CHATRA_COMPANY_CODE,
  USER_STATUS,
  USER_ROLES
} from "../constants/constants.js";

const SALT_ROUNDS = 10;

// Configuration
const SEEDER_CONFIG = {
  planName: "Free Internal Plan",
  planDescription: "Free internal plan for JAF Chatra with unlimited usage",
  companyName: "JAF Chatra",
  companyCode: JAF_CHATRA_COMPANY_CODE.toUpperCase(),
  adminFullName: "Master Admin",
  adminEmail: "admin@jafchatra.com",
  adminPassword: "@D123123d@", // Should be changed in production
  adminRole: USER_ROLES.MASTER_ADMIN.value,
};

// Logger utility
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[✓ SUCCESS] ${new Date().toISOString()} - ${msg}`),
  warning: (msg) => console.log(`[⚠ WARNING] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[✗ ERROR] ${new Date().toISOString()} - ${msg}`),
};

/**
 * Step 1: Ensure Free Internal Subscription Plan exists
 */
const seedSubscriptionPlan = async () => {
  try {
    log.info("Starting subscription plan seeding...");

    const { connection } = getMasterConnection();
    const SubscriptionPlan = getSubscriptionPlanModel(connection);

    // Check if FREE_INTERNAL plan already exists
    const existingPlan = await SubscriptionPlan.findOne({
      name: { $regex: `^${SEEDER_CONFIG.planName}$`, $options: "i" },
    }).lean();

    if (existingPlan) {
      log.warning(`Plan "${SEEDER_CONFIG.planName}" already exists with ID: ${existingPlan._id}`);
      return existingPlan;
    }

    // Create new plan with unlimited features
    const newPlan = await SubscriptionPlan.create({
      name: SEEDER_CONFIG.planName,
      description: SEEDER_CONFIG.planDescription,
      price: 0,
      limits: {
        maxAgents: 999999, // Unlimited
        maxWebsites: 999999, // Unlimited
      },
      features: {
        analytics: true,
        fileSharing: true,
        visitorTracking: true,
        prioritySupport: true,
      },
      isPosted: true,
    });

    log.success(`Subscription plan "${SEEDER_CONFIG.planName}" created with ID: ${newPlan._id}`);
    return newPlan;
  } catch (error) {
    log.error(`Failed to seed subscription plan: ${error.message}`);
    throw error;
  }
};

/**
 * Step 2: Ensure default JAF Chatra exists
 */
const seedCompany = async (subscriptionPlan) => {
  try {
    log.info("Starting company seeding...");

    const { connection } = getMasterConnection();
    const Tenant = getTenantModel(connection);
    const Subscription = getSubscriptionModel(connection);

    // Check if company already exists
    const normalizedCode = SEEDER_CONFIG.companyCode.toLowerCase();
    const existingTenant = await Tenant.findOne({
      $or: [
        { companyCode: SEEDER_CONFIG.companyCode },
        { companyCode: normalizedCode },
      ],
    }).lean();

    if (existingTenant) {
      log.warning(
        `Company "${SEEDER_CONFIG.companyName}" already exists with ID: ${existingTenant._id}`
      );
      return existingTenant;
    }

    const databaseName = databaseNameSlugger(SEEDER_CONFIG.companyName);

    // Initialize tenant database
    log.info(`Initializing tenant database: ${databaseName}...`);
    await initializeTenantDB(databaseName);

    // Create tenant
    const newTenant = await Tenant.create({
      companyName: SEEDER_CONFIG.companyName,
      databaseName,
      companyCode: SEEDER_CONFIG.companyCode,
    });

    log.success(`Company "${SEEDER_CONFIG.companyName}" created with ID: ${newTenant._id}`);

    // Create subscription for this company
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1); // 1 year from now

    const newSubscription = await Subscription.create({
      tenantId: newTenant._id,
      subscriptionPlanId: subscriptionPlan._id,
      subscriptionStart,
      subscriptionEnd,
      status: "ACTIVATED",
    });

    log.success(
      `Subscription created for company with ID: ${newSubscription._id} (expires: ${subscriptionEnd.toISOString().split("T")[0]})`
    );

    return { tenant: newTenant, databaseName };
  } catch (error) {
    log.error(`Failed to seed company: ${error.message}`);
    throw error;
  }
};

/**
 * Step 3: Create default Master Admin agent for the company
 */
const seedMasterAdmin = async (databaseName) => {
  try {
    log.info("Starting master admin seeding...");

    const { Agents } = getTenantConnection(databaseName);

    // Check if admin already exists
    const existingAdmin = await Agents.findOne({
      emailAddress: SEEDER_CONFIG.adminEmail.toLowerCase(),
    }).lean();

    if (existingAdmin) {
      log.warning(
        `Admin "${SEEDER_CONFIG.adminFullName}" already exists with ID: ${existingAdmin._id}`
      );
      return existingAdmin;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(SEEDER_CONFIG.adminPassword, SALT_ROUNDS);

    // Create admin agent
    const newAdmin = await Agents.create({
      fullName: SEEDER_CONFIG.adminFullName,
      emailAddress: SEEDER_CONFIG.adminEmail.toLowerCase(),
      password: hashedPassword,
      phoneNumber: null,
      profilePicture: null,
      status: USER_STATUS.OFFLINE,
      role: SEEDER_CONFIG.adminRole,
    });

    log.success(`Master Admin "${SEEDER_CONFIG.adminFullName}" created with ID: ${newAdmin._id}`);
    log.info(`Admin login credentials - Email: ${SEEDER_CONFIG.adminEmail}`);

    return newAdmin;
  } catch (error) {
    log.error(`Failed to seed master admin: ${error.message}`);
    throw error;
  }
};

/**
 * Main seeder function
 */
const seedDatabase = async () => {
  try {
    log.info("========================================");
    log.info("Starting JAF Chatra Database Seeding");
    log.info("========================================");

    // Initialize master database connection
    log.info("Connecting to master database...");
    await connectMasterDB();
    log.success("Master database connected");

    // Step 1: Seed subscription plan
    const subscriptionPlan = await seedSubscriptionPlan();

    // Step 2: Seed company
    const { databaseName } = await seedCompany(subscriptionPlan);

    // Step 3: Seed master admin
    await seedMasterAdmin(databaseName);

    log.info("========================================");
    log.success("Database seeding completed successfully!");
    log.info("========================================");
    log.info("\nNext steps:");
    log.info(`1. Change the default admin password: ${SEEDER_CONFIG.adminPassword}`);
    log.info(`2. Login with email: ${SEEDER_CONFIG.adminEmail}`);
    log.info(`3. Configure additional settings from the admin panel`);

    process.exit(0);
  } catch (error) {
    log.error("Database seeding failed!");
    log.error(error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();
