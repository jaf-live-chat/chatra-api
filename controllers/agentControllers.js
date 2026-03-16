import { getMasterConnection } from "../config/masterDB.js";
import { TENANT_STATUS } from "../constants/constants.js";
import { getSubscriptionModel } from "../models/master/Subscriptions.js";
import { getTenantModel } from "../models/master/Tenants.js";
import { ForbiddenError, InternalServerError } from "../utils/errors.js";

import expressAsyncHandler from "express-async-handler";
import agentServices from "../services/tenant/agentServices.js";

const loginAgent = expressAsyncHandler(async (req, res) => {
  const { companyCode, emailAddress, password } = req.body || {};
  const normalizedCompanyCode = String(companyCode || "").trim().toLowerCase();

  const { connection } = getMasterConnection();
  const Tenant = getTenantModel(connection);
  const Subscription = getSubscriptionModel(connection);

  const tenant = await Tenant.findOne({ companyCode: normalizedCompanyCode }).lean();

  if (!tenant) {
    throw new ForbiddenError("Invalid companyCode.");
  }

  const now = new Date();
  const activeSubscription = await Subscription.findOne({
    tenantId: tenant._id,
    status: TENANT_STATUS.ACTIVATED,
    subscriptionStart: { $lte: now },
    subscriptionEnd: { $gte: now },
  })
    .sort({ subscriptionEnd: -1 })
    .lean();

  if (!activeSubscription) {
    throw new ForbiddenError("Subscription is inactive or expired.");
  }

  const databaseName = tenant.databaseName;

  if (!databaseName) {
    throw new InternalServerError("Unable to resolve tenant database for login.");
  }

  const loginResult = await agentServices.loginAgent({
    databaseName,
    tenantId: tenant._id,
    emailAddress,
    password,
  });

  res.status(200).json({
    success: true,
    message: "Login successful.",
    accessToken: loginResult.accessToken,
    tokenType: loginResult.tokenType,
    expiresIn: loginResult.expiresIn,
    tenant: {
      id: tenant._id,
      companyName: tenant.companyName,
      companyCode: tenant.companyCode,
    },
    agent: loginResult.agent,
  });
});

export { loginAgent };