import { DB_URI } from "../constants/constants.js";
import mongoose from "mongoose";

// MODELS
import { getAgentModel } from "../models/tenant/Agents.js";

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
    connections[dbName] = mongoose.createConnection(buildTenantUri(dbName), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  const conn = connections[dbName];

  return {
    Agents: getAgentModel(conn),
  };
}

export async function initializeTenantDB(dbName) {
  const conn = mongoose.createConnection(buildTenantUri(dbName));
  await conn.asPromise();

  const Agents = getAgentModel(conn);
  await Agents.createCollection();

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