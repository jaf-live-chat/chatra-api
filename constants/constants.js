import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const APP_NAME = `JAF Live Chat`;

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


const MASTER_DB_NAME = 'jafchatra_master';
const TENANT_DB_PREFIX = 'tenant_';

export {
  PORT,
  API_VERSION,
  APP_NAME,
  CORS_OPTIONS,
  TENANT_STATUS,
  SUBSCRIPTION_PLANS,
  MASTER_DB_NAME,
  TENANT_DB_PREFIX,
};