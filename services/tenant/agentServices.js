import { logger } from "../../utils/logger.js";
import { getTenantConnection } from "../../config/tenantDB.js";
import {
  JWT_EXPIRES_IN,
  JWT_SECRET,
  USER_STATUS,
} from "../../constants/constants.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from "../../utils/errors.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import emailService from "../../utils/emailService.js";
import baseEmailTemplate from "../../templates/base-email/baseEmail.js";
import agentCredentialsEmail from "../../templates/base-email/agents/agentCredentialsEmail.js";
import passwordResetOTPEmail from "../../templates/base-email/agents/passwordResetOTPEmail.js";
import crypto from "crypto";
import { broadcastLiveChatEvent } from "../liveChatRealtime.js";
import { canManuallyUpdateAgentStatus, getManagedAgentStatus } from "../../utils/agentStatusRules.js";

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

const generateOTP = () => {
  return String(Math.floor(Math.random() * Math.pow(10, OTP_LENGTH)))
    .padStart(OTP_LENGTH, "0");
};

const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const verifyOTPHash = (otp, otpHash) => {
  return hashOTP(otp) === otpHash;
};

const sanitizeAgent = (agent) => {
  if (!agent) return null;

  const agentObject =
    typeof agent.toObject === "function" ? agent.toObject() : { ...agent };
  delete agentObject.password;
  return agentObject;
};

const shouldEnableSupportSelfPick = (previousStatus, nextStatus, role) => {
  if (role !== "SUPPORT_AGENT") {
    return false;
  }

  const normalizedPrevious = String(previousStatus || "").toUpperCase();
  const normalizedNext = String(nextStatus || "").toUpperCase();

  return [USER_STATUS.OFFLINE, USER_STATUS.AWAY].includes(normalizedPrevious)
    && normalizedNext === USER_STATUS.AVAILABLE;
};

const getOpenConversationCount = async (databaseName, agentId) => {
  const { Conversations } = getTenantConnection(databaseName);

  return Conversations.countDocuments({
    agentId,
    status: "OPEN",
  });
};

const createAgent = async (payload) => {
  try {
    const { databaseName, agents, agentData, createdBy } = payload || {};
    const normalizedAgents = Array.isArray(agents)
      ? agents
      : agentData
        ? [agentData]
        : [];

    if (!databaseName) {
      throw new BadRequestError("databaseName is required to create agents");
    }

    if (!Array.isArray(normalizedAgents) || normalizedAgents.length === 0) {
      throw new BadRequestError("agents must be a non-empty array");
    }

    const { Agents } = getTenantConnection(databaseName);

    const emailsToInsert = normalizedAgents.map((a) =>
      a.emailAddress.toLowerCase(),
    );
    const existing = await Agents.find(
      { emailAddress: { $in: emailsToInsert } },
      { emailAddress: 1 },
    ).lean();

    if (existing.length > 0) {
      const duplicates = existing.map((a) => a.emailAddress).join(", ");
      throw new ConflictError(
        `The following email addresses are already registered: ${duplicates}`,
      );
    }

    const emailCredentials = normalizedAgents.map((agent) => ({
      fullName: agent.fullName,
      emailAddress: agent.emailAddress.toLowerCase(),
      password: agent.password,
      role: agent.role,
    }));

    const agentsToInsert = await Promise.all(
      normalizedAgents.map(async (agent) => ({
        fullName: agent.fullName,
        emailAddress: agent.emailAddress.toLowerCase(),
        password: await bcrypt.hash(agent.password, SALT_ROUNDS),
        profilePicture: agent.profilePicture ?? null,
        phoneNumber: agent.phoneNumber ?? null,
        status: USER_STATUS.OFFLINE,
        role: agent.role,
      })),
    );

    const createdAgents = await Agents.insertMany(agentsToInsert);

    const creatorContext =
      createdBy && typeof createdBy === "object" ? createdBy : {};

    const credentialEmails = createdAgents.map((agent, index) => {
      const credentialData = emailCredentials[index] || {
        fullName: agent.fullName,
        emailAddress: agent.emailAddress,
        password: "",
        role: agent.role,
      };

      return {
        to: agent.emailAddress,
        subject: "Your JAF Chatra agent account credentials",
        html: baseEmailTemplate(
          agentCredentialsEmail({
            agentData: credentialData,
            createBy: creatorContext,
          }),
        ),
      };
    });

    await emailService.sendBulkEmails(credentialEmails);

    return { agents: createdAgents.map(sanitizeAgent) };
  } catch (error) {
    logger.error(`Error creating agents: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create agents: ${error.message}`);
  }
};

const loginAgent = async (payload) => {
  try {
    const { databaseName, tenantId, emailAddress, password } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required for login");
    }

    if (!emailAddress || !password) {
      throw new BadRequestError("emailAddress and password are required");
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findOne({
      emailAddress: emailAddress.toLowerCase(),
    });

    if (!agent) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(password, agent.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (!JWT_SECRET) {
      throw new InternalServerError("JWT_SECRET is not configured");
    }

    const openConversationCount = await getOpenConversationCount(databaseName, agent._id);
    const nextStatus = getManagedAgentStatus(openConversationCount);
    const enableSelfPick = shouldEnableSupportSelfPick(agent.status, nextStatus, agent.role);
    const onlineAgent = await Agents.findByIdAndUpdate(
      agent._id,
      {
        status: nextStatus,
        ...(enableSelfPick
          ? {
            selfPickEligible: true,
            selfPickEligibleAt: new Date(),
            selfPickConsumedAt: null,
          }
          : {}),
      },
      { new: true },
    );

    if (!onlineAgent) {
      throw new InternalServerError("Unable to update agent status during login");
    }

    broadcastLiveChatEvent(
      { databaseName },
      "AGENT_STATUS_UPDATED",
      { agent: sanitizeAgent(onlineAgent) },
    );

    const expiresIn = JWT_EXPIRES_IN || "1d";
    const accessToken = jwt.sign(
      {
        agentId: String(onlineAgent._id),
        tenantId: tenantId ? String(tenantId) : null,
        databaseName,
        role: onlineAgent.role,
        emailAddress: onlineAgent.emailAddress,
      },
      JWT_SECRET,
      { expiresIn }
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn,
      agent: sanitizeAgent(onlineAgent),
    };
  } catch (error) {
    logger.error(`Error logging in agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to login agent: ${error.message}`);
  }
};

const logoutAgent = async (payload) => {
  try {
    const { databaseName, agentId } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required");
    }

    const { Agents } = getTenantConnection(databaseName);

    const updatedAgent = await Agents.findByIdAndUpdate(
      agentId,
      {
        status: USER_STATUS.OFFLINE,
        selfPickEligible: false,
      },
      { new: true },
    ).select("-password");

    if (updatedAgent) {
      broadcastLiveChatEvent(
        { databaseName },
        "AGENT_STATUS_UPDATED",
        { agent: sanitizeAgent(updatedAgent) },
      );
    }

    return { message: "Logout successful." };
  } catch (error) {
    logger.error(`Error logging out agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to logout agent: ${error.message}`);
  }
};

const updateAgentStatus = async (payload) => {
  try {
    const { databaseName, agentId, status } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required");
    }

    if (!status) {
      throw new BadRequestError("status is required");
    }

    const { Agents } = getTenantConnection(databaseName);
    const normalizedStatus = String(status).trim().toUpperCase();

    const currentAgent = await Agents.findById(agentId).select("-password").lean();

    if (!currentAgent) {
      throw new BadRequestError("Agent not found");
    }

    const openConversationCount = await getOpenConversationCount(databaseName, agentId);
    const statusDecision = canManuallyUpdateAgentStatus(normalizedStatus, openConversationCount);

    if (!statusDecision.allowed) {
      throw new ForbiddenError(statusDecision.message);
    }

    const shouldEnableSelfPick = shouldEnableSupportSelfPick(
      currentAgent.status,
      statusDecision.status,
      currentAgent.role,
    );

    const updatePayload = {
      status: statusDecision.status,
    };

    if (shouldEnableSelfPick) {
      updatePayload.selfPickEligible = true;
      updatePayload.selfPickEligibleAt = new Date();
      updatePayload.selfPickConsumedAt = null;
    }

    if ([USER_STATUS.AWAY, USER_STATUS.OFFLINE].includes(normalizedStatus)) {
      updatePayload.selfPickEligible = false;
    }

    const updatedAgent = await Agents.findByIdAndUpdate(
      agentId,
      updatePayload,
      { new: true, runValidators: true },
    ).select("-password");

    const sanitizedAgent = sanitizeAgent(updatedAgent);

    broadcastLiveChatEvent(
      { databaseName },
      "AGENT_STATUS_UPDATED",
      { agent: sanitizedAgent },
    );

    return { agent: sanitizedAgent };
  } catch (error) {
    logger.error(`Error updating agent status: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update status: ${error.message}`);
  }
};

const getAgents = async (payload) => {
  try {
    const { databaseName, page = 1, limit = 10, search = "" } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { Agents } = getTenantConnection(databaseName);

    const searchQuery = search
      ? {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { emailAddress: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ],
      }
      : {};

    const [agents, total] = await Promise.all([
      Agents.find(searchQuery)
        .select("-password")
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean(),
      Agents.countDocuments(searchQuery),
    ]);

    return {
      agents: agents.map(sanitizeAgent),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        limit: limitNum,
      },
    };
  } catch (error) {
    logger.error(`Error fetching agents: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch agents: ${error.message}`);
  }
};

const getAgentById = async (payload) => {
  try {
    const { databaseName, agentId } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required");
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findById(agentId).select("-password").lean();

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    return { agent: sanitizeAgent(agent) };
  } catch (error) {
    logger.error(`Error fetching agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch agent: ${error.message}`);
  }
};

const updateAgent = async (payload) => {
  try {
    const { databaseName, agentId, updateData } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError("At least one field is required to update");
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findById(agentId);

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    // Check for email conflicts if email is being updated
    if (updateData.emailAddress && updateData.emailAddress !== agent.emailAddress) {
      const existingAgent = await Agents.findOne({
        emailAddress: updateData.emailAddress.toLowerCase(),
        _id: { $ne: agentId },
      }).lean();

      if (existingAgent) {
        throw new ConflictError(
          `Email address ${updateData.emailAddress} is already in use`
        );
      }
    }

    // Hash password if being updated
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
    }

    // Normalize email
    if (updateData.emailAddress) {
      updateData.emailAddress = updateData.emailAddress.toLowerCase();
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
      const openConversationCount = await getOpenConversationCount(databaseName, agentId);
      const statusDecision = canManuallyUpdateAgentStatus(updateData.status, openConversationCount);

      if (!statusDecision.allowed) {
        throw new ForbiddenError(statusDecision.message);
      }

      updateData.status = statusDecision.status;
    }

    // Only allow specific fields to be updated
    const allowedFields = ["fullName", "emailAddress", "password", "phoneNumber", "profilePicture", "status", "role"];
    const filteredUpdate = {};

    allowedFields.forEach((field) => {
      if (field in updateData) {
        filteredUpdate[field] = updateData[field];
      }
    });

    const updatedAgent = await Agents.findByIdAndUpdate(agentId, filteredUpdate, {
      new: true,
      runValidators: true,
    }).select("-password");

    return { agent: sanitizeAgent(updatedAgent) };
  } catch (error) {
    logger.error(`Error updating agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update agent: ${error.message}`);
  }
};

const deleteAgent = async (payload) => {
  try {
    const { databaseName, agentId } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required");
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findByIdAndDelete(agentId);

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    return { message: "Agent deleted successfully" };
  } catch (error) {
    logger.error(`Error deleting agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to delete agent: ${error.message}`);
  }
};

const verifyAgentPassword = async (payload) => {
  try {
    const { databaseName, agentId, password } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!agentId || !password) {
      throw new BadRequestError("agentId and password are required");
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findById(agentId).select("password").lean();

    if (!agent?.password) {
      throw new UnauthorizedError("Invalid password.");
    }

    const isPasswordValid = await bcrypt.compare(password, agent.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid password.");
    }

    return { verified: true };
  } catch (error) {
    logger.error(`Error verifying agent password: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to verify password: ${error.message}`);
  }
};

const requestPasswordReset = async (payload) => {
  try {
    const { databaseName, emailAddress } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!emailAddress) {
      throw new BadRequestError("emailAddress is required");
    }

    const { Agents, PasswordResetOTP } = getTenantConnection(databaseName);
    const normalizedEmail = emailAddress.toLowerCase();

    // Verify agent exists
    const agent = await Agents.findOne({
      emailAddress: normalizedEmail,
    }).lean();

    if (!agent) {
      // Don't reveal if email exists or not (security best practice)
      return { message: "If the email exists, a password reset OTP has been sent." };
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing OTP records for this email
    await PasswordResetOTP.deleteMany({ email: normalizedEmail });

    // Create new OTP record
    await PasswordResetOTP.create({
      email: normalizedEmail,
      otpHash,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // Send email with OTP
    await emailService.sendEmail({
      to: normalizedEmail,
      subject: "Password Reset - One-Time Password",
      html: baseEmailTemplate(
        passwordResetOTPEmail({
          email: normalizedEmail,
          otp,
          expiresInMinutes: OTP_EXPIRY_MINUTES,
        }),
      ),
    });

    logger.info(`Password reset OTP sent to ${normalizedEmail}`);

    return { message: "If the email exists, a password reset OTP has been sent." };
  } catch (error) {
    logger.error(`Error requesting password reset: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(
      `Failed to request password reset: ${error.message}`
    );
  }
};

const verifyPasswordResetOTP = async (payload) => {
  try {
    const { databaseName, emailAddress, otp } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!emailAddress || !otp) {
      throw new BadRequestError("emailAddress and otp are required");
    }

    const normalizedEmail = emailAddress.toLowerCase();
    const { PasswordResetOTP } = getTenantConnection(databaseName);

    const otpRecord = await PasswordResetOTP.findOne({
      email: normalizedEmail,
    });

    if (!otpRecord) {
      throw new BadRequestError("Invalid OTP or email. Please request a new OTP.");
    }

    if (otpRecord.verified) {
      throw new BadRequestError("OTP already used. Please request a new one.");
    }

    if (new Date() > otpRecord.expiresAt) {
      await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
      throw new BadRequestError("OTP has expired. Please request a new one.");
    }

    if (otpRecord.attempts >= 5) {
      await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
      throw new BadRequestError("Too many failed attempts. Please request a new OTP.");
    }

    if (!verifyOTPHash(otp, otpRecord.otpHash)) {
      otpRecord.attempts += 1;
      otpRecord.lastAttemptAt = new Date();
      await otpRecord.save();

      const remainingAttempts = 5 - otpRecord.attempts;
      if (remainingAttempts === 0) {
        await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
        throw new BadRequestError(
          "Too many failed attempts. Please request a new OTP."
        );
      }

      throw new BadRequestError(
        `Invalid OTP. ${remainingAttempts} attempts remaining.`
      );
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    logger.info(`OTP verified for ${normalizedEmail}`);

    return { message: "OTP verified successfully." };
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to verify OTP: ${error.message}`);
  }
};

const resetPassword = async (payload) => {
  try {
    const { databaseName, emailAddress, newPassword } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required");
    }

    if (!emailAddress || !newPassword) {
      throw new BadRequestError("emailAddress and newPassword are required");
    }

    if (newPassword.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    const normalizedEmail = emailAddress.toLowerCase();
    const { Agents, PasswordResetOTP } = getTenantConnection(databaseName);

    // Check if OTP was verified
    const otpRecord = await PasswordResetOTP.findOne({
      email: normalizedEmail,
    });

    if (!otpRecord || !otpRecord.verified) {
      throw new BadRequestError(
        "Invalid request. Please verify OTP before resetting password."
      );
    }

    // Update agent password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const agent = await Agents.findOneAndUpdate(
      { emailAddress: normalizedEmail },
      { password: hashedPassword },
      { new: true }
    );

    if (!agent) {
      throw new BadRequestError("Agent not found");
    }

    // Delete OTP record
    await PasswordResetOTP.deleteOne({ _id: otpRecord._id });

    logger.info(`Password reset successfully for ${normalizedEmail}`);

    return {
      message: "Password has been reset successfully. Please login with your new password.",
    };
  } catch (error) {
    logger.error(`Error resetting password: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to reset password: ${error.message}`);
  }
};

export default {
  createAgent,
  loginAgent,
  logoutAgent,
  updateAgentStatus,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  verifyAgentPassword,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
};
