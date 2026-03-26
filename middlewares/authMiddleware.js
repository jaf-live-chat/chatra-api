import { JWT_SECRET, USER_ROLES } from "../constants/constants.js";
import { getTenantConnection } from "../config/tenantDB.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import jwt from "jsonwebtoken";

/**
 * Verifies the Bearer JWT and attaches the authenticated agent to req.agent.
 * Must be used after tenantAuth when the tenant context is required on the request.
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new UnauthorizedError("No token provided. Authorization header must be: Bearer <token>"));
    }

    const token = authHeader.split(" ")[1];

    if (!JWT_SECRET) {
      return next(new Error("JWT_SECRET is not configured"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new UnauthorizedError("Token has expired."));
      }
      return next(new UnauthorizedError("Invalid token."));
    }

    const { agentId, databaseName } = decoded;

    if (!agentId || !databaseName) {
      return next(new UnauthorizedError("Invalid token payload."));
    }

    const { Agents } = getTenantConnection(databaseName);
    const agent = await Agents.findById(agentId).select("-password").lean();

    if (!agent) {
      return next(new UnauthorizedError("Agent no longer exists."));
    }

    req.agent = agent;
    req.auth = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Restricts access to agents with the ADMIN role only.
 * Must be used after protect.
 */
export const adminAuth = (req, res, next) => {
  const allowedRoles = [USER_ROLES.ADMIN.value, USER_ROLES.MASTER_ADMIN.value];

  if (!req.agent || !allowedRoles.includes(req.agent.role)) {
    return next(new ForbiddenError("Access denied. Admin or Master admin role required."));
  }
  next();
};

/**
 * Restricts access to users with the MASTER_ADMIN role only.
 * Must be used after protect.
 */
export const masterAdminAuth = (req, res, next) => {
  if (req.agent?.role !== USER_ROLES.MASTER_ADMIN.value) {
    return next(new ForbiddenError("Access denied. Master admin role required."));
  }
  next();
};

/**
 * Restricts access to agents with either the ADMIN or SUPPORT_AGENT role.
 * Must be used after protect.
 */
export const agentAuth = (req, res, next) => {
  const allowedRoles = [USER_ROLES.ADMIN.value, USER_ROLES.SUPPORT_AGENT.value];

  if (!req.agent || !allowedRoles.includes(req.agent.role)) {
    return next(new ForbiddenError("Access denied. Agent role required."));
  }
  next();
};