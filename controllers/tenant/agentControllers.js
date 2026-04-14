import { logger } from "../../utils/logger.js";
import { getMasterConnection } from "../../config/masterDB.js";
import { APP_URL, TENANT_STATUS, USER_ROLES, USER_STATUS } from "../../constants/constants.js";
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "../../utils/errors.js";
import { resolveTenantDatabaseName } from "../../utils/tenantContext.js";

import expressAsyncHandler from "express-async-handler";
import agentServices from "../../services/tenant/agentServices.js";
import { uploadToCloudinary } from "../../utils/fileUploadService.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ADMIN_SELF_PROTECTION_MESSAGE =
  "You cannot change your own role/status to restricted values or remove your own admin access.";

const PRIVILEGED_ROLES = [USER_ROLES.MASTER_ADMIN.value, USER_ROLES.ADMIN.value];

const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(String(role || ""));

const resolveTenantApiKey = async (tenantId, subscriptionId) => {
  if (!tenantId || !subscriptionId) {
    return null;
  }

  const { APIKey } = getMasterConnection();
  const subscriptionApiKey = await APIKey.findOne({ tenantId, subscriptionId }).lean();
  return subscriptionApiKey?.apiKey || null;
};

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
    const databaseName = resolveTenantDatabaseName(req);

    const response = await agentServices.createAgent({
      databaseName,
      agents: req.body.agents,
      subscription: req.subscription,
      createdBy: {
        fullName: req.tenant?.companyName
          ? `${req.tenant.companyName} Admin`
          : "Administrator",
        companyCode: req.tenant?.companyCode || "",
      },
    });

    res.status(201).json({
      success: true,
      message: `${response.agents.length} agent(s) created successfully.`,
      agents: response.agents,
      subscriptionUsage: response.subscriptionUsage || null,
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

    const isPrivilegedAgent = [USER_ROLES.MASTER_ADMIN.value, USER_ROLES.ADMIN.value].includes(
      loginResult.agent?.role
    );
    const tenantApiKey = isPrivilegedAgent
      ? await resolveTenantApiKey(tenant._id, activeSubscription?._id)
      : null;
    const subscriptionData = isPrivilegedAgent && activeSubscription
      ? {
        id: String(activeSubscription._id),
        tenantId: activeSubscription.tenantId ? String(activeSubscription.tenantId) : String(tenant._id),
        subscriptionPlanId: activeSubscription.subscriptionPlanId
          ? String(activeSubscription.subscriptionPlanId)
          : "",
        planName: activeSubscription?.configuration?.planName || subscriptionPlan?.name || "No Plan",
        startDate: activeSubscription.subscriptionStart
          ? new Date(activeSubscription.subscriptionStart).toISOString()
          : "",
        endDate: activeSubscription.subscriptionEnd
          ? new Date(activeSubscription.subscriptionEnd).toISOString()
          : "",
        status: activeSubscription.status,
        configuration: activeSubscription.configuration || null,
      }
      : null;

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
        apiKey: tenantApiKey,
        subscriptionData,
        subscription: {
          planName: activeSubscription?.configuration?.planName || subscriptionPlan?.name || "No Plan",
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

const logoutAgent = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const agentId = String(req.agent?._id || "");

    if (!agentId) {
      throw new UnauthorizedError("Unauthorized.");
    }

    const response = await agentServices.logoutAgent({
      databaseName,
      agentId,
    });

    res.status(200).json({
      success: true,
      message: response.message,
    });
  } catch (error) {
    logger.error(`Error during agent logout: ${error.message}`);
    throw error;
  }
});

const updateMyStatus = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const agentId = String(req.agent?._id || "");

    if (!agentId) {
      throw new UnauthorizedError("Unauthorized.");
    }

    const status = String(req.body?.status || "").trim().toUpperCase();
    const allowedSelfStatuses = [USER_STATUS.AVAILABLE, USER_STATUS.AWAY];

    if (!allowedSelfStatuses.includes(status)) {
      throw new BadRequestError("Invalid status value. Allowed values: AVAILABLE, AWAY.");
    }

    const response = await agentServices.updateAgentStatus({
      databaseName,
      agentId,
      status,
    });

    res.status(200).json({
      success: true,
      message: "Status updated successfully.",
      agent: response.agent,
    });
  } catch (error) {
    logger.error(`Error updating my status: ${error.message}`);
    throw error;
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

    const isPrivilegedAgent = [USER_ROLES.MASTER_ADMIN.value, USER_ROLES.ADMIN.value].includes(
      agent?.role
    );
    const tenantApiKey = isPrivilegedAgent
      ? await resolveTenantApiKey(tenant._id, activeSubscription?._id)
      : null;
    const subscriptionData = isPrivilegedAgent && activeSubscription
      ? {
        id: String(activeSubscription._id),
        tenantId: activeSubscription.tenantId ? String(activeSubscription.tenantId) : String(tenant._id),
        subscriptionPlanId: activeSubscription.subscriptionPlanId
          ? String(activeSubscription.subscriptionPlanId)
          : "",
        planName: activeSubscription?.configuration?.planName || subscriptionPlan?.name || "No Plan",
        startDate: activeSubscription.subscriptionStart
          ? new Date(activeSubscription.subscriptionStart).toISOString()
          : "",
        endDate: activeSubscription.subscriptionEnd
          ? new Date(activeSubscription.subscriptionEnd).toISOString()
          : "",
        status: activeSubscription.status,
        configuration: activeSubscription.configuration || null,
      }
      : null;

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      tenant: {
        id: tenant._id,
        companyName: tenant.companyName,
        companyCode: tenant.companyCode,
        apiKey: tenantApiKey,
        subscriptionData,
        subscription: {
          planName: activeSubscription?.configuration?.planName || subscriptionPlan?.name || "No Plan",
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
    const databaseName = resolveTenantDatabaseName(req);

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

    const maxAgents = req.subscription?.configuration?.limits?.maxAgents;
    const hasMaxAgentsLimit = Number.isFinite(maxAgents) && maxAgents < 999999;
    const currentAgentCount = response.pagination?.totalRecords ?? response.agents.length;

    res.status(200).json({
      success: true,
      message: "Agents retrieved successfully.",
      agents: response.agents,
      pagination: response.pagination,
      subscriptionUsage: {
        usedAgents: currentAgentCount,
        maxAgents: hasMaxAgentsLimit ? maxAgents : null,
        remainingAgents: hasMaxAgentsLimit ? Math.max(maxAgents - currentAgentCount, 0) : null,
        hasAdvancedAnalytics: Boolean(req.subscription?.configuration?.limits?.hasAdvancedAnalytics),
      },
    });
  } catch (error) {
    logger.error(`Error fetching agents: ${error.message}`);
    throw error;
  }
});

const getSingleAgentById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);

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
    const databaseName = resolveTenantDatabaseName(req);

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const agentId = String(req.agent?._id || "");

    if (!agentId) {
      throw new BadRequestError("Authenticated agent id is required.");
    }

    const updateData = normalizeProfileUpdateData(req.body || {});

    if (req.file) {
      const uploadedAvatar = await uploadToCloudinary(req.file, {
        folder: "jaf-chatra/avatars",
        fileCategory: "IMAGES",
        resource_type: "image",
      });

      updateData.profilePicture = uploadedAvatar.url;
    }

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

const verifyMyPassword = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const agentId = String(req.agent?._id || "");
    const password = String(req.body?.password || "");

    if (!agentId || !password) {
      throw new BadRequestError("password is required.");
    }

    await agentServices.verifyAgentPassword({
      databaseName,
      agentId,
      password,
    });

    res.status(200).json({
      success: true,
      message: "Password verified successfully.",
      verified: true,
    });
  } catch (error) {
    logger.error(`Error verifying password: ${error.message}`);
    throw error;
  }
});

const editAgentById = expressAsyncHandler(async (req, res) => {
  try {
    const databaseName = resolveTenantDatabaseName(req);

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

    if (isSelfEdit) {
      throw new ForbiddenError("You cannot update your own account from this endpoint.");
    }

    const existingAgentResponse = await agentServices.getAgentById({
      databaseName,
      agentId: id,
    });

    if (!existingAgentResponse?.agent) {
      throw new NotFoundError("Agent not found");
    }

    const targetRole = String(existingAgentResponse.agent.role || "");

    if (isAdmin) {
      const tokenTenantId = String(req.auth?.tenantId || "");
      const requestTenantId = String(req.tenant?._id || "");

      if (!tokenTenantId || !requestTenantId || tokenTenantId !== requestTenantId) {
        throw new ForbiddenError("Admin can only edit agents within the same tenant.");
      }

      if (isPrivilegedRole(targetRole)) {
        throw new ForbiddenError("Only Master Admin can update Admin or Master Admin accounts.");
      }

      if (
        Object.prototype.hasOwnProperty.call(updateData, "role") &&
        updateData.role !== USER_ROLES.SUPPORT_AGENT.value
      ) {
        throw new ForbiddenError("Only Master Admin can assign Admin or Master Admin roles.");
      }
    }

    validateAdminEditData(updateData);

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
    const databaseName = resolveTenantDatabaseName(req);

    if (!databaseName) {
      throw new InternalServerError("Unable to resolve tenant database.");
    }

    const { id } = req.params;
    const currentAgentId = String(req.agent?._id || "");
    const currentRole = String(req.agent?.role || "");
    const isMasterAdmin = currentRole === USER_ROLES.MASTER_ADMIN.value;
    const isAdmin = currentRole === USER_ROLES.ADMIN.value;

    if (currentAgentId && currentAgentId === String(id)) {
      throw new ForbiddenError(ADMIN_SELF_PROTECTION_MESSAGE);
    }

    const existingAgentResponse = await agentServices.getAgentById({
      databaseName,
      agentId: id,
    });

    if (!existingAgentResponse?.agent) {
      throw new NotFoundError("Agent not found");
    }

    const targetRole = String(existingAgentResponse.agent.role || "");

    if (isAdmin && isPrivilegedRole(targetRole)) {
      throw new ForbiddenError("Only Master Admin can delete Admin or Master Admin accounts.");
    }

    if (!isMasterAdmin && !isAdmin) {
      throw new ForbiddenError("Only Admin or Master Admin can delete agents.");
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

const requestPasswordReset = expressAsyncHandler(async (req, res) => {
  try {
    const { companyCode, emailAddress } = req.body || {};

    if (!companyCode || !emailAddress) {
      throw new BadRequestError("companyCode and emailAddress are required");
    }

    const normalizedCompanyCode = String(companyCode || "").trim();
    const { Tenant } = getMasterConnection();

    // Resolve tenant from companyCode
    const tenant = await Tenant.findOne({
      companyCode: { $regex: `^${escapeRegex(normalizedCompanyCode)}$`, $options: "i" },
    }).lean();

    if (!tenant) {
      throw new BadRequestError("Invalid company code or email. Please check and try again.");
    }

    const databaseName = tenant.databaseName;

    const response = await agentServices.requestPasswordReset({
      databaseName,
      companyCode: normalizedCompanyCode,
      emailAddress,
      resetUrl: `${APP_URL}/reset-password?companyCode=${encodeURIComponent(normalizedCompanyCode)}&emailAddress=${encodeURIComponent(String(emailAddress || "").trim().toLowerCase())}`,
    });

    res.status(200).json({
      success: true,
      message: response.message,
    });
  } catch (error) {
    logger.error(`Error requesting password reset: ${error.message}`);
    throw error;
  }
});

const verifyPasswordResetOTP = expressAsyncHandler(async (req, res) => {
  try {
    const { companyCode, emailAddress, otp } = req.body || {};

    if (!companyCode || !emailAddress || !otp) {
      throw new BadRequestError("companyCode, emailAddress, and otp are required");
    }

    const normalizedCompanyCode = String(companyCode || "").trim();
    const { Tenant } = getMasterConnection();

    // Resolve tenant from companyCode
    const tenant = await Tenant.findOne({
      companyCode: { $regex: `^${escapeRegex(normalizedCompanyCode)}$`, $options: "i" },
    }).lean();

    if (!tenant) {
      throw new BadRequestError("Invalid company code or email. Please check and try again.");
    }

    const databaseName = tenant.databaseName;

    const response = await agentServices.verifyPasswordResetOTP({
      databaseName,
      emailAddress,
      otp,
    });

    res.status(200).json({
      success: true,
      message: response.message,
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    throw error;
  }
});

const resetPassword = expressAsyncHandler(async (req, res) => {
  try {
    const { companyCode, emailAddress, newPassword } = req.body || {};

    if (!companyCode || !emailAddress || !newPassword) {
      throw new BadRequestError("companyCode, emailAddress, and newPassword are required");
    }

    if (newPassword.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    const normalizedCompanyCode = String(companyCode || "").trim();
    const { Tenant } = getMasterConnection();

    // Resolve tenant from companyCode
    const tenant = await Tenant.findOne({
      companyCode: { $regex: `^${escapeRegex(normalizedCompanyCode)}$`, $options: "i" },
    }).lean();

    if (!tenant) {
      throw new BadRequestError("Invalid company code or email. Please check and try again.");
    }

    const databaseName = tenant.databaseName;

    const response = await agentServices.resetPassword({
      databaseName,
      emailAddress,
      newPassword,
    });

    res.status(200).json({
      success: true,
      message: response.message,
    });
  } catch (error) {
    logger.error(`Error resetting password: ${error.message}`);
    throw error;
  }
});

export {
  createAgent,
  loginAgent,
  logoutAgent,
  updateMyStatus,
  getMe,
  getAgents,
  getSingleAgentById,
  updateMyProfile,
  verifyMyPassword,
  editAgentById,
  deleteAgent,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
};