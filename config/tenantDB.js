import { DB_URI } from "../constants/constants.js";
import mongoose from "mongoose";

// MODELS
import { getAgentModel } from "../models/tenant/Agents.js";
import { getVisitorModel } from "../models/tenant/Visitors.js";
import { getAppSettingsModel } from "../models/tenant/AppSettings.js";
import { getChatSettingsModel } from "../models/tenant/ChatSettings.js";
import { getMessageModel } from "../models/tenant/Messages.js";
import { getConversationModel } from "../models/tenant/Conversations.js";
import { getQuickRepliesModel } from "../models/tenant/QuickReplies.js";
import { getQuickMessagesModel } from "../models/tenant/QuickMessage.js";
import { getPasswordResetOTPModel } from "../models/tenant/PasswordResetOTP.js";

const connections = {}; // cache

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
  if (!connections[dbName]) {
    connections[dbName] = mongoose.createConnection(buildTenantUri(dbName));
  }

  const conn = connections[dbName];

  return {
    Agents: getAgentModel(conn),
    AppSettings: getAppSettingsModel(conn),
    ChatSettings: getChatSettingsModel(conn),
    Visitors: getVisitorModel(conn),
    Messages: getMessageModel(conn),
    Conversations: getConversationModel(conn),
    QuickReplies: getQuickRepliesModel(conn),
    QuickMessages: getQuickMessagesModel(conn),
    PasswordResetOTP: getPasswordResetOTPModel(conn),
  };
}

export async function initializeTenantDB(dbName) {
  const conn = mongoose.createConnection(buildTenantUri(dbName));
  await conn.asPromise();

  // agents
  const Agents = getAgentModel(conn);
  await Agents.createCollection();

  // visitors
  const Visitors = getVisitorModel(conn);
  await Visitors.createCollection();

  // App Settings
  const AppSettings = getAppSettingsModel(conn);
  await AppSettings.createCollection();

  // Chat Settings
  const ChatSettings = getChatSettingsModel(conn);
  await ChatSettings.createCollection();

  // Messages
  const Messages = getMessageModel(conn);
  await Messages.createCollection();

  // Conversations
  const Conversations = getConversationModel(conn);
  await Conversations.createCollection();

  // Quick Replies
  const QuickReplies = getQuickRepliesModel(conn);
  await QuickReplies.createCollection();

  const QuickMessages = getQuickMessagesModel(conn);
  await QuickMessages.createCollection();

  const PasswordResetOTP = getPasswordResetOTPModel(conn);
  await PasswordResetOTP.createCollection();

  connections[dbName] = conn; // cache for later use
  return conn;
}

export async function dropTenantDB(dbName) {
  const conn = connections[dbName] || mongoose.createConnection(buildTenantUri(dbName));
  await conn.asPromise();
  await conn.dropDatabase();
  await conn.close();
  delete connections[dbName];
}