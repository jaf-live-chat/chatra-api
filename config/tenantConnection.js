import mongoose from "mongoose";

const connections = {};

const uri = process.env.NODE_ENV === "production"
  ? process.env.MONGO_TENANT_DB_URI_PROD
  : process.env.MONGO_TENANT_DB_URI_LOCAL;

export function getTenantConnection(dbName) {
  if (!connections[dbName]) {
    connections[dbName] = mongoose.createConnection(
      uri,
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
  }
  return connections[dbName];
}