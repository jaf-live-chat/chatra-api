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

const SALT_ROUNDS = 10;

const sanitizeAgent = (agent) => {
  if (!agent) return null;

  const agentObject =
    typeof agent.toObject === "function" ? agent.toObject() : { ...agent };
  delete agentObject.password;
  return agentObject;
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

    const expiresIn = JWT_EXPIRES_IN || "1d";
    const accessToken = jwt.sign(
      {
        agentId: String(agent._id),
        tenantId: tenantId ? String(tenantId) : null,
        databaseName,
        role: agent.role,
        emailAddress: agent.emailAddress,
      },
      JWT_SECRET,
      { expiresIn }
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn,
      agent: sanitizeAgent(agent),
    };
  } catch (error) {
    logger.error(`Error logging in agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to login agent: ${error.message}`);
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

export default {
  createAgent,
  loginAgent,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
};
