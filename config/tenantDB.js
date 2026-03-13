import { DB_URI } from "../constants/constants.js";
import mongoose from "mongoose";

// MODELS
import { getUserModel } from "../models/tenant/Users.js";

const connections = {}; // cache

export function getTenantConnection(dbName) {
  if (!connections[dbName]) {
    connections[dbName] = mongoose.createConnection(
      `${DB_URI}${dbName}`,
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
  }

  const conn = connections[dbName];

  return {
    Users: getUserModel(conn),
  };
}