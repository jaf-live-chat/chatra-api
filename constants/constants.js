import dotenv from 'dotenv';
dotenv.config();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    crimson: '\x1b[38m' // Scarlet
  },
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    gray: '\x1b[100m',
    crimson: '\x1b[48m'
  }
};

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

const SENDER_TYPES = {
  AGENT: 'AGENT',
  CUSTOMER: 'CUSTOMER',
  BOT: 'BOT',
};

const AGENT_ROLES = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  SUPERVISOR: 'SUPERVISOR',
};

const CONVERSATION_STATUS = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

const MASTER_DB_NAME = 'jafchatra_master';

const TENANT_DB_PREFIX = 'tenant_';

const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export {
  PORT,
  API_VERSION,
  APP_NAME,
  CORS_OPTIONS,
  COLORS,
  TENANT_STATUS,
  SUBSCRIPTION_PLANS,
  SENDER_TYPES,
  AGENT_ROLES,
  CONVERSATION_STATUS,
  MASTER_DB_NAME,
  TENANT_DB_PREFIX,
  TENANT_CACHE_TTL_MS,
};