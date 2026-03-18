import { logger } from "../../utils/logger.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { TENANT_STATUS } from "../../constants/constants.js";
import { ForbiddenError, InternalServerError } from "../../utils/errors.js";

import expressAsyncHandler from "express-async-handler";
import agentServices from "../../services/tenant/agentServices.js";

const createAgent = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const response = await agentServices.createAgent({
      databaseName,
      agents: req.body.agents,
      createdBy: {
        fullName: req.tenant?.companyName
          ? `${req.tenant.companyName} Admin`
          : "Administrator",
      },
    });

    res.status(201).json({
      success: true,
      message: `${response.agents.length} agent(s) created successfully.`,
      agents: response.agents,
    });
  } catch (error) {
    logger.error(`Error creating agent: ${error.message}`);
    throw error;
  }
});

const loginAgent = expressAsyncHandler(async (req, res) => {
  try {
    const { companyCode, emailAddress, password } = req.body || {};
    const normalizedCompanyCode = String(companyCode || "").trim().toLowerCase();

    const { Tenant, Subscription } = getMasterConnection();

    const tenant = await Tenant.findOne({ companyCode: normalizedCompanyCode }).lean();

    if (!tenant) {
      throw new ForbiddenError("Invalid companyCode.");
    }

    const now = new Date();
    const activeSubscription = await Subscription.findOne({
      tenantId: tenant._id,
      status: TENANT_STATUS.ACTIVATED,
      subscriptionStart: { $lte: now },
      $or: [
        { subscriptionEnd: { $gte: now } },
        { subscriptionEnd: null },
        { subscriptionEnd: { $exists: false } },
      ],
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
  } catch (error) {
    logger.error(`Error during agent login: ${error.message}`);
    throw new ForbiddenError(`Login failed: ${error.message}`);
  }
});

const getAgents = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { page, limit, search } = req.query;

    const response = await agentServices.getAgents({
      databaseName,
      page,
      limit,
      search,
    });

    res.status(200).json({
      success: true,
      message: "Agents retrieved successfully.",
      agents: response.agents,
      pagination: response.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching agents: ${error.message}`);
    throw error;
  }
});

const getAgentById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { agentId } = req.params;

    const response = await agentServices.getAgentById({
      databaseName,
      agentId,
    });

    res.status(200).json({
      success: true,
      message: "Agent retrieved successfully.",
      agent: response.agent,
    });
  } catch (error) {
    logger.error(`Error fetching agent: ${error.message}`);
    throw error;
  }
});

const updateAgent = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { agentId } = req.params;

    const response = await agentServices.updateAgent({
      databaseName,
      agentId,
      updateData: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Agent updated successfully.",
      agent: response.agent,
    });
  } catch (error) {
    logger.error(`Error updating agent: ${error.message}`);
    throw error;
  }
});

const deleteAgent = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { agentId } = req.params;

    await agentServices.deleteAgent({
      databaseName,
      agentId,
    });

    res.status(200).json({
      success: true,
      message: "Agent deleted successfully.",
    });
  } catch (error) {
    logger.error(`Error deleting agent: ${error.message}`);
    throw error;
  }
});

export {
  createAgent,
  loginAgent,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
};