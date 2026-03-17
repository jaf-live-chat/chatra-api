import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN
const APP_NAME = `JAF Chatra`;
const APP_EMAIL = `support@jafchatra.com`
const DB_URI =
  process.env.NODE_ENV === 'production'
    ? process.env.MONGO_MASTER_DB_URI_PROD
    : process.env.MONGO_MASTER_DB_URI_LOCAL;

const MASTER_DB_NAME = 'jafchatra_master';
const TENANT_DB_PREFIX = 'tenant_';
const JAF_CHATRA_COMPANY_CODE = 'JAFC';

const STARTUP_SEED_CONFIG = {
  planName: process.env.STARTUP_SEED_PLAN_NAME || 'Free Internal Plan',
  planDescription:
    process.env.STARTUP_SEED_PLAN_DESCRIPTION ||
    'Free internal plan for JAF Chatra with unlimited usage',
  companyName: process.env.STARTUP_SEED_COMPANY_NAME || 'JAF Chatra',
  companyCode: (process.env.STARTUP_SEED_COMPANY_CODE || JAF_CHATRA_COMPANY_CODE).toUpperCase(),
  adminFullName: process.env.STARTUP_SEED_ADMIN_FULL_NAME || 'Master Admin',
  adminEmail: (process.env.STARTUP_SEED_ADMIN_EMAIL || 'admin@jafchatra.com').toLowerCase(),
  adminPassword: process.env.STARTUP_SEED_ADMIN_PASSWORD || '@D123123d@',
  adminRole: process.env.STARTUP_SEED_ADMIN_ROLE || 'MASTER_ADMIN',
  saltRounds: Number(process.env.STARTUP_SEED_SALT_ROUNDS || 10),
};

const CORS_OPTIONS = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
};

const TENANT_STATUS = {
  ACTIVATED: 'ACTIVATED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  DEACTIVATED: 'DEACTIVATED',
};

const SUBSCRIPTION_PLANS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
  FREE_INTERNAL: 'FREE_INTERNAL',
};

const USER_STATUS = {
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
  AWAY: 'AWAY',
};

const USER_ROLES = {
  MASTER_ADMIN: {
    label: 'Master Admin',
    value: 'MASTER_ADMIN',
  },
  ADMIN: {
    label: 'Admin',
    value: 'ADMIN',
  },
  SUPPORT_AGENT: {
    label: 'Support Agent',
    value: 'SUPPORT_AGENT',
  },
  VISITOR: {
    label: 'Visitor',
    value: 'VISITOR',
  }
}

const CONVERSATION_STATUS = {
  ACTIVE: 'ACTIVE',
  QUEUED: 'QUEUED',
  ENDED: 'ENDED',
};

const ASSIGNMENT_STRATEGIES = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL',
}

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
}

export {
  PORT,
  DB_URI,
  APP_EMAIL,
  API_VERSION,
  APP_NAME,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  CORS_OPTIONS,
  TENANT_STATUS,
  SUBSCRIPTION_PLANS,
  PAYMENT_STATUS,
  MASTER_DB_NAME,
  TENANT_DB_PREFIX,
  JAF_CHATRA_COMPANY_CODE,
  STARTUP_SEED_CONFIG,
  USER_STATUS,
  USER_ROLES,
  CONVERSATION_STATUS,
  ASSIGNMENT_STRATEGIES
};