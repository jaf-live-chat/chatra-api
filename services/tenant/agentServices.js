import { logger } from "../../utils/logger.js";
import { getTenantConnection } from "../../config/tenantDB.js";
import { JWT_EXPIRES_IN, JWT_SECRET, USER_STATUS } from "../../constants/constants.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from "../../utils/errors.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

const sanitizeAgent = (agent) => {
  if (!agent) return null;

  const agentObject = typeof agent.toObject === "function" ? agent.toObject() : { ...agent };
  delete agentObject.password;
  return agentObject;
};

const createAgent = async (payload) => {
  try {
    const { databaseName, agents, agentData } = payload || {};
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

    const emailsToInsert = normalizedAgents.map((a) => a.emailAddress.toLowerCase());
    const existing = await Agents.find(
      { emailAddress: { $in: emailsToInsert } },
      { emailAddress: 1 }
    ).lean();

    if (existing.length > 0) {
      const duplicates = existing.map((a) => a.emailAddress).join(", ");
      throw new ConflictError(
        `The following email addresses are already registered: ${duplicates}`
      );
    }

    const agentsToInsert = await Promise.all(
      normalizedAgents.map(async (agent) => ({
        fullName: agent.fullName,
        emailAddress: agent.emailAddress.toLowerCase(),
        password: await bcrypt.hash(agent.password, SALT_ROUNDS),
        profilePicture: agent.profilePicture ?? null,
        phoneNumber: agent.phoneNumber ?? null,
        status: USER_STATUS.OFFLINE,
        role: agent.role,
      }))
    );

    const createdAgents = await Agents.insertMany(agentsToInsert);

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
    const agent = await Agents.findOne({ emailAddress: emailAddress.toLowerCase() });

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

export default {
  createAgent,
  loginAgent,
};