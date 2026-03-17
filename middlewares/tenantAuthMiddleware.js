import { getMasterConnection } from "../config/masterDB.js";
import { getTenantConnection } from "../config/tenantDB.js";
import { TENANT_STATUS } from "../constants/constants.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

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

  if (!apiKey) {
    return next(
      new UnauthorizedError("Missing API key. Provide it in the x-api-key header.")
    );
  }

  try {
    const { APIKey, Tenant, Subscription } = getMasterConnection();

    const apiKeyRecord = await APIKey.findOne({ apiKey }).lean();

    const tenant = apiKeyRecord
      ? await Tenant.findById(apiKeyRecord.tenantId).lean()
      : await Tenant.findOne({ apiKey }).lean();

    if (!tenant) {
      return next(new ForbiddenError("Invalid API key."));
    }

    const now = new Date();
    const activeSubscription = await Subscription.findOne({
      tenantId: tenant._id,
      status: TENANT_STATUS.ACTIVATED,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now },
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
