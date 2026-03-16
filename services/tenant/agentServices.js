import { logger } from "../../utils/logger.js";
import { getTenantConnection } from "../../config/tenantDB.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../constants/constants.js";
import {
  AppError,
  BadRequestError,
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
    const { databaseName, agentData } = payload || {};

    if (!databaseName) {
      throw new BadRequestError("databaseName is required to create an agent");
    }

    const {
      fullName,
      emailAddress,
      password,
      profilePicture = null,
      phoneNumber = null,
      status,
      role,
    } = agentData || {};

    if (!password) {
      throw new BadRequestError("password is required to create an agent");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const { Agents } = getTenantConnection(databaseName);

    const [newAgent] = await Agents.create([
      {
        fullName,
        emailAddress,
        password: hashedPassword,
        profilePicture,
        phoneNumber,
        status,
        role,
      },
    ]);

    return newAgent;
  } catch (error) {
    logger.error(`Error creating agent: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to create agent: ${error.message}`);
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