import dotenv from "dotenv";
dotenv.config();

// ─── Server / Environment ────────────────────────────────────────────────────
const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const DB_URI = process.env.MONGO_MASTER_DB_URI
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const CORS_OPTIONS = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

// ─── App Identity ────────────────────────────────────────────────────────────
const APP_NAME = `JAF Chatra`;
const APP_EMAIL = `support@jafchatra.com`;
const APP_LOGO = {
  logoMain:
    "https://res.cloudinary.com/dvrhry6ru/image/upload/v1773735919/logo1_f5e86y.png",
  logoLight:
    "https://res.cloudinary.com/dvrhry6ru/image/upload/v1775447929/white_1_vpoeuh.png",
  logoDark:
    "https://res.cloudinary.com/dvrhry6ru/image/upload/v1773735919/logo3_a0x3s4.png",
};

const getAPPUrl = () => {
  switch (process.env.NODE_ENV) {
    case "PRODUCTION":
      return "https://www.jafchatra.com";
    case "DEVELOPMENT":
      return process.env.BASE_URL_DEVELOPMENT || "http://localhost:3001";
    default:
      return process.env.BASE_URL_LOCAL || "http://localhost:3001";
  }
}

const APP_URL = getAPPUrl();

// ─── Database ────────────────────────────────────────────────────────────────
const MASTER_DB_NAME = "jafchatra_master";
const TENANT_DB_PREFIX = "tenant_";

// ─── Tenant Setup ────────────────────────────────────────────────────────────
const JAF_CHATRA_COMPANY_CODE = "JAFC";
const STARTUP_SEED_CONFIG = {
  planName: "Free Internal Plan",
  planDescription: "This is a free internal plan for the owner.",
  companyName: process.env.STARTUP_SEED_COMPANY_NAME,
  companyCode: process.env.STARTUP_SEED_COMPANY_CODE,
  adminFullName: process.env.STARTUP_SEED_ADMIN_FULL_NAME,
  adminEmail: process.env.STARTUP_SEED_ADMIN_EMAIL,
  adminPassword: process.env.STARTUP_SEED_ADMIN_PASSWORD,
  adminRole: process.env.STARTUP_SEED_ADMIN_ROLE,
  saltRounds: 10,
};
const TENANT_STATUS = {
  ACTIVATED: "ACTIVATED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  DEACTIVATED: "DEACTIVATED",
  SCHEDULED: "SCHEDULED",
};

// ─── Subscriptions & Billing ─────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = {
  FREE: "FREE",
  STARTER: "STARTER",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
  FREE_INTERNAL: "FREE_INTERNAL",
};

const PAYMENT_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

// ─── Users ───────────────────────────────────────────────────────────────────
const USER_ROLES = {
  MASTER_ADMIN: {
    label: "Master Admin",
    value: "MASTER_ADMIN",
  },
  ADMIN: {
    label: "Admin",
    value: "ADMIN",
  },
  SUPPORT_AGENT: {
    label: "Support Agent",
    value: "SUPPORT_AGENT",
  },
  VISITOR: {
    label: "Visitor",
    value: "VISITOR",
  },
};

const USER_STATUS = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  OFFLINE: "OFFLINE",
  AWAY: "AWAY",
};

// ─── Conversations ───────────────────────────────────────────────────────────
const CONVERSATION_STATUS = {
  WAITING: "WAITING",
  OPEN: "OPEN",
  ENDED: "ENDED",
};
const QUEUE_STATUS = {
  WAITING: "WAITING",
  ASSIGNED: "ASSIGNED",
};
const ASSIGNMENT_STRATEGIES = {
  AUTOMATIC: "AUTOMATIC",
  MANUAL: "MANUAL",
};

export {
  // Server / Environment
  PORT,
  API_VERSION,
  DB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  CORS_OPTIONS,

  // App Identity
  APP_NAME,
  APP_EMAIL,
  APP_LOGO,
  APP_URL,
  // Database
  MASTER_DB_NAME,
  TENANT_DB_PREFIX,

  // Tenant Setup
  JAF_CHATRA_COMPANY_CODE,
  STARTUP_SEED_CONFIG,
  TENANT_STATUS,

  // Subscriptions & Billing
  SUBSCRIPTION_PLANS,
  PAYMENT_STATUS,

  // Users
  USER_ROLES,
  USER_STATUS,

  // Conversations
  CONVERSATION_STATUS,
  QUEUE_STATUS,
  ASSIGNMENT_STRATEGIES,
};
