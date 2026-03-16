import { getMasterConnection } from "../config/masterDB.js";
import { getTenantModel } from "../models/master/Tenants.js";
import { getTenantConnection } from "../config/tenantDB.js";

/**
 * Middleware that authenticates a tenant via the `x-api-key` request header.
 *
 * On success it attaches:
 *   req.tenant   — the tenant document from the master DB
 *   req.tenantDB — the Mongoose models bound to that tenant's database
 */
const tenantAuth = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "Missing API key. Provide it in the x-api-key header.",
    });
  }

  try {
    const { connection } = getMasterConnection();
    const Tenant = getTenantModel(connection);

    const tenant = await Tenant.findOne({ apiKey }).lean();

    if (!tenant) {
      return res.status(403).json({
        success: false,
        message: "Invalid API key.",
      });
    }

    req.tenant = tenant;
    req.tenantDB = getTenantConnection(tenant.databaseName);

    next();
  } catch (error) {
    next(error);
  }
};

export default tenantAuth;
