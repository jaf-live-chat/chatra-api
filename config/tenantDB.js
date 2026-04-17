import { DB_URI } from "../constants/constants.js";
import mongoose from "mongoose";

// MODELS
import { getAgentModel } from "../models/tenant/Agents.js";
import { getVisitorModel } from "../models/tenant/Visitors.js";
import { getChatSettingsModel } from "../models/tenant/ChatSettings.js";
import { getMessageModel } from "../models/tenant/Messages.js";
import { getConversationModel } from "../models/tenant/Conversations.js";
import { getQueueModel } from "../models/tenant/Queue.js";
import { getQuickRepliesModel } from "../models/tenant/QuickReplies.js";
import { getQuickMessagesModel } from "../models/tenant/QuickMessage.js";
import { getPasswordResetOTPModel } from "../models/tenant/PasswordResetOTP.js";
import { getWidgetSettingsModel } from "../models/tenant/WidgetSettings.js";
import { getNotificationModel } from "../models/tenant/Notifications.js";
import { getConversationFeedbackModel } from "../models/tenant/ConversationFeedback.js";

const connections = {}; // cache
const connectionPromises = {}; // in-flight connection promises by db

const tenantConnectionOptions = {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  waitQueueTimeoutMS: 10000,
  autoIndex: false,
};

function attachTenantConnectionListeners(dbName, conn) {
  if (conn.__chatraListenersAttached) {
    return;
  }

  conn.__chatraListenersAttached = true;

  conn.on("disconnected", () => {
    console.warn(`[tenant:${dbName}] MongoDB disconnected`);
  });

  conn.on("error", (err) => {
    console.error(`[tenant:${dbName}] MongoDB error: ${err.message}`);
  });

  conn.on("close", () => {
    if (connections[dbName] === conn) {
      delete connections[dbName];
    }
    delete connectionPromises[dbName];
  });
}

function ensureTenantConnection(dbName) {
  const cachedConn = connections[dbName];

  if (cachedConn && cachedConn.readyState !== 3) {
    return cachedConn;
  }

  const conn = mongoose.createConnection(
    buildTenantUri(dbName),
    tenantConnectionOptions
  );
  connections[dbName] = conn;
  attachTenantConnectionListeners(dbName, conn);
  connectionPromises[dbName] = conn.asPromise().finally(() => {
    delete connectionPromises[dbName];
  });

  return conn;
}

async function waitForTenantConnection(dbName) {
  const conn = ensureTenantConnection(dbName);

  if (conn.readyState === 1) {
    return conn;
  }

  if (!connectionPromises[dbName]) {
    connectionPromises[dbName] = conn.asPromise().finally(() => {
      delete connectionPromises[dbName];
    });
  }

  await connectionPromises[dbName];
  return conn;
}

function buildTenantUri(dbName) {
  if (!DB_URI) {
    throw new Error(
      "Tenant DB base URI is missing. Set MONGO_URI_LOCAL/MONGO_URI_PROD (or MONGO_MASTER_DB_URI_LOCAL/PROD)."
    );
  }

  const baseUri = DB_URI.trim();
  const match = baseUri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/i);

  if (!match) {
    throw new Error(
      `Invalid MongoDB base URI: ${baseUri}. It must start with mongodb:// or mongodb+srv://`
    );
  }

  const hostPart = match[1];
  const query = match[3];

  return `${hostPart}/${dbName}${query ? `?${query}` : ""}`;
}

export function getTenantConnection(dbName) {
  const conn = ensureTenantConnection(dbName);

  return {
    Agents: getAgentModel(conn),
    ChatSettings: getChatSettingsModel(conn),
    Visitors: getVisitorModel(conn),
    Messages: getMessageModel(conn),
    Conversations: getConversationModel(conn),
    Queue: getQueueModel(conn),
    QuickReplies: getQuickRepliesModel(conn),
    QuickMessages: getQuickMessagesModel(conn),
    PasswordResetOTP: getPasswordResetOTPModel(conn),
    WidgetSettings: getWidgetSettingsModel(conn),
    Notification: getNotificationModel(conn),
    ConversationFeedback: getConversationFeedbackModel(conn),
  };
}

export async function initializeTenantDB(dbName) {
  const conn = await waitForTenantConnection(dbName);

  // agents
  const Agents = getAgentModel(conn);
  await Agents.createCollection();

  // visitors
  const Visitors = getVisitorModel(conn);
  await Visitors.createCollection();

  // Chat Settings
  const ChatSettings = getChatSettingsModel(conn);
  await ChatSettings.createCollection();

  // Messages
  const Messages = getMessageModel(conn);
  await Messages.createCollection();

  // Conversations
  const Conversations = getConversationModel(conn);
  await Conversations.createCollection();

  // Queue
  const Queue = getQueueModel(conn);
  await Queue.createCollection();

  // Quick Replies
  const QuickReplies = getQuickRepliesModel(conn);
  await QuickReplies.createCollection();

  // Quick Messages
  const QuickMessages = getQuickMessagesModel(conn);
  await QuickMessages.createCollection();

  // Password Reset OTP
  const PasswordResetOTP = getPasswordResetOTPModel(conn);
  await PasswordResetOTP.createCollection();

  // Widget Settings
  const WidgetSettings = getWidgetSettingsModel(conn);
  await WidgetSettings.createCollection();

  // Notifications
  const Notification = getNotificationModel(conn);
  await Notification.createCollection();

  // Conversation Feedback
  const ConversationFeedback = getConversationFeedbackModel(conn);
  await ConversationFeedback.createCollection();

  return conn;
}

export async function dropTenantDB(dbName) {
  const conn = connections[dbName] || mongoose.createConnection(
    buildTenantUri(dbName),
    tenantConnectionOptions
  );
  await conn.asPromise();
  await conn.dropDatabase();
  await conn.close();
  delete connections[dbName];
  delete connectionPromises[dbName];
}