import { logger } from "../../utils/logger.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { TENANT_STATUS, USER_ROLES, USER_STATUS } from "../../constants/constants.js";
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "../../utils/errors.js";

import expressAsyncHandler from "express-async-handler";
import agentServices from "../../services/tenant/agentServices.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ADMIN_SELF_PROTECTION_MESSAGE =
  "You cannot change your own role/status to restricted values or remove your own admin access.";

const normalizeProfileUpdateData = (payload) => {
  const data = payload && typeof payload === "object" ? payload : {};
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(data, "fullName")) {
    updateData.fullName = String(data.fullName || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "emailAddress")) {
    updateData.emailAddress = String(data.emailAddress || "").trim().toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(data, "password")) {
    updateData.password = String(data.password || "");
  }

  if (Object.prototype.hasOwnProperty.call(data, "phoneNumber")) {
    const phone = data.phoneNumber;
    updateData.phoneNumber = phone == null ? null : String(phone).trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "profilePicture")) {
    const picture = data.profilePicture;
    updateData.profilePicture = picture == null ? null : String(picture).trim();
  }

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    updateData.status = String(data.status || "").trim().toUpperCase();
  }

  if (Object.prototype.hasOwnProperty.call(data, "role")) {
    updateData.role = String(data.role || "").trim().toUpperCase();
  }

  return updateData;
};

const validateMyProfileData = (updateData) => {
  if (!updateData || Object.keys(updateData).length === 0) {
    throw new BadRequestError("At least one field is required to update profile.");
  }

  if (Object.prototype.hasOwnProperty.call(updateData, "role")) {
    throw new ForbiddenError("You are not allowed to change your own role.");
  }

  if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
    throw new ForbiddenError("You are not allowed to change your own status in this endpoint.");
  }
};

const validateAdminEditData = (updateData) => {
  if (!updateData || Object.keys(updateData).length === 0) {
    throw new BadRequestError("At least one field is required to update agent.");
  }

  if (
    Object.prototype.hasOwnProperty.call(updateData, "role") &&
    !Object.values(USER_ROLES)
      .map((item) => item.value)
      .includes(updateData.role)
  ) {
    throw new BadRequestError("Invalid role value.");
  }

  if (
    Object.prototype.hasOwnProperty.call(updateData, "status") &&
    !Object.values(USER_STATUS).includes(updateData.status)
  ) {
    throw new BadRequestError("Invalid status value.");
  }
};

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
    const normalizedCompanyCode = String(companyCode || "").trim();

    const { Tenant, Subscription, SubscriptionPlan } = getMasterConnection();

    const tenant = await Tenant.findOne({
      companyCode: { $regex: `^${escapeRegex(normalizedCompanyCode)}$`, $options: "i" },
    }).lean();

    if (!tenant) {
      throw new ForbiddenError("Invalid Company Code.");
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

    const subscriptionPlan = activeSubscription?.subscriptionPlanId
      ? await SubscriptionPlan.findById(activeSubscription.subscriptionPlanId).lean()
      : null;

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
        subscription: {
          planName: subscriptionPlan?.name || "No Plan",
          startDate: activeSubscription?.subscriptionStart
            ? new Date(activeSubscription.subscriptionStart).toISOString()
            : "",
          endDate: activeSubscription?.subscriptionEnd
            ? new Date(activeSubscription.subscriptionEnd).toISOString()
            : "",
        },
      },
      agent: loginResult.agent,
    });
  } catch (error) {
    logger.error(`Error during agent login: ${error.message}`);
    throw new ForbiddenError(`Login failed: ${error.message}`);
  }
});

const getMe = expressAsyncHandler(async (req, res) => {
  try {
    const tenant = req.tenant;
    const agent = req.agent;
    const activeSubscription = req.subscription;

    if (!tenant || !agent) {
      throw new UnauthorizedError("Unauthorized.");
    }

    const { SubscriptionPlan } = getMasterConnection();
    const subscriptionPlan = activeSubscription?.subscriptionPlanId
      ? await SubscriptionPlan.findById(activeSubscription.subscriptionPlanId).lean()
      : null;

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      tenant: {
        id: tenant._id,
        companyName: tenant.companyName,
        companyCode: tenant.companyCode,
        subscription: {
          planName: subscriptionPlan?.name || "No Plan",
          startDate: activeSubscription?.subscriptionStart
            ? new Date(activeSubscription.subscriptionStart).toISOString()
            : "",
          endDate: activeSubscription?.subscriptionEnd
            ? new Date(activeSubscription.subscriptionEnd).toISOString()
            : "",
        },
      },
      agent,
    });
  } catch (error) {
    logger.error(`Error fetching authenticated profile: ${error.message}`);
    throw error;
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

const getSingleAgentById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { id } = req.params;

    const response = await agentServices.getAgentById({
      databaseName,
      agentId: id,
    });

    if (!response?.agent) {
      throw new NotFoundError("Agent not found");
    }

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

const updateMyProfile = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const agentId = String(req.agent?._id || "");

    if (!agentId) {
      throw new BadRequestError("Authenticated agent id is required.");
    }

    const updateData = normalizeProfileUpdateData(req.body || {});
    validateMyProfileData(updateData);

    const response = await agentServices.updateAgent({
      databaseName,
      agentId,
      updateData,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      agent: response.agent,
    });
  } catch (error) {
    logger.error(`Error updating own profile: ${error.message}`);
    throw error;
  }
});

const editAgentById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = req.tenant?.databaseName;

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { id } = req.params;
    const updateData = normalizeProfileUpdateData(req.body || {});
    const currentAgentId = String(req.agent?._id || "");
    const currentRole = String(req.agent?.role || "");
    const isSelfEdit = currentAgentId && currentAgentId === String(id);
    const isMasterAdmin = currentRole === USER_ROLES.MASTER_ADMIN.value;
    const isAdmin = currentRole === USER_ROLES.ADMIN.value;

    if (!isSelfEdit && !isMasterAdmin && !isAdmin) {
      throw new ForbiddenError("You can only edit your own account unless you are an admin.");
    }

    if (isAdmin && !isSelfEdit) {
      const tokenTenantId = String(req.auth?.tenantId || "");
      const requestTenantId = String(req.tenant?._id || "");

      if (!tokenTenantId || !requestTenantId || tokenTenantId !== requestTenantId) {
        throw new ForbiddenError("Admin can only edit agents within the same tenant.");
      }
    }

    if (isSelfEdit && !isMasterAdmin) {
      validateMyProfileData(updateData);
    } else {
      validateAdminEditData(updateData);
    }

    if (
      isSelfEdit &&
      ((Object.prototype.hasOwnProperty.call(updateData, "role") && updateData.role !== req.agent?.role) ||
        (Object.prototype.hasOwnProperty.call(updateData, "status") && updateData.status === USER_STATUS.OFFLINE))
    ) {
      throw new ForbiddenError(ADMIN_SELF_PROTECTION_MESSAGE);
    }

    const response = await agentServices.updateAgent({
      databaseName,
      agentId: id,
      updateData,
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

    const { id } = req.params;
    const currentAgentId = String(req.agent?._id || "");

    if (currentAgentId && currentAgentId === String(id)) {
      throw new ForbiddenError(ADMIN_SELF_PROTECTION_MESSAGE);
    }

    await agentServices.deleteAgent({
      databaseName,
      agentId: id,
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
  getMe,
  getAgents,
  getSingleAgentById,
  updateMyProfile,
  editAgentById,
  deleteAgent,
};