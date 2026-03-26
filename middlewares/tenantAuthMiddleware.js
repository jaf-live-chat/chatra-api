import { getMasterConnection } from "../config/masterDB.js";
import { getTenantConnection } from "../config/tenantDB.js";
import { JWT_SECRET, TENANT_STATUS } from "../constants/constants.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import jwt from "jsonwebtoken";

/**
 * Middleware that authenticates a tenant via the `x-api-key` request header.
 *
 * On success it attaches:
 *   req.tenant   — the tenant document from the master DB
 *   req.subscription — the active subscription document from the master DB
 *   req.tenantDB — the Mongoose models bound to that tenant's database
 */
const tenantAuth = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  try {
    const { APIKey, Tenant, Subscription } = getMasterConnection();

    let tenant = null;

    if (apiKey) {
      const apiKeyRecord = await APIKey.findOne({ apiKey }).lean();

      tenant = apiKeyRecord
        ? await Tenant.findById(apiKeyRecord.tenantId).lean()
        : await Tenant.findOne({ apiKey }).lean();
    } else {
      const authHeader = req.headers["authorization"];

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(
          new UnauthorizedError("Missing API key. Provide it in the x-api-key header.")
        );
      }

      const token = authHeader.split(" ")[1];
      let decoded;

      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          return next(new UnauthorizedError("Token has expired."));
        }
        return next(new UnauthorizedError("Invalid authentication token."));
      }

      const tenantId = decoded?.tenantId;
      const databaseName = decoded?.databaseName;

      tenant = tenantId
        ? await Tenant.findById(tenantId).lean()
        : databaseName
          ? await Tenant.findOne({ databaseName }).lean()
          : null;
    }

    if (!tenant) {
      return next(
        new ForbiddenError(apiKey ? "Invalid API key." : "Tenant not found for the provided token.")
      );
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
      return next(new ForbiddenError("Subscription is inactive or expired."));
    }

    req.tenant = tenant;
    req.tenantDB = getTenantConnection(tenant.databaseName);
    req.subscription = activeSubscription;

    next();
  } catch (error) {
    next(error);
  }
};

export default tenantAuth;