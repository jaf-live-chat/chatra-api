import { getTenantConnection } from "../../config/tenantDB.js";
import { USER_ROLES, USER_STATUS } from "../../constants/constants.js";
import { logger } from "../../utils/logger.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const createAgent = async (payload) => {
  try {
    const { databaseName, agentData } = payload || {};

    if (!databaseName) {
      throw new Error("databaseName is required to create an agent");
    }

    const {
      fullName,
      emailAddress,
      password,
      profilePicture = null,
      phoneNumber = null,
      status = USER_STATUS.AVAILABLE,
      role = USER_ROLES.ADMIN.value,
    } = agentData || {};

    if (!password) {
      throw new Error("password is required to create an agent");
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
    throw new Error(`Failed to create agent: ${error.message}`);
  }
}

export default {
  createAgent,
};