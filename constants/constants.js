import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const APP_NAME = `JAF Live Chat`;
const DB_URI =
  process.env.NODE_ENV === 'production'
    ? process.env.MONGO_MASTER_DB_URI_PROD
    : process.env.MONGO_MASTER_DB_URI_LOCAL;

const MASTER_DB_NAME = 'jafchatra_master';
const TENANT_DB_PREFIX = 'tenant_';

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

export {
  PORT,
  DB_URI,
  API_VERSION,
  APP_NAME,
  CORS_OPTIONS,
  TENANT_STATUS,
  SUBSCRIPTION_PLANS,
  MASTER_DB_NAME,
  TENANT_DB_PREFIX,
  USER_STATUS,
  USER_ROLES,
  CONVERSATION_STATUS,
  ASSIGNMENT_STRATEGIES
};