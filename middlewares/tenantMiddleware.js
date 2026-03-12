import { resolveTenant, getTenantDb } from '../config/tenantResolver.js';
import { logger } from '../utils/logger.js';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const tenantMiddleware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  // 1. Reject requests with no API key immediately
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing x-api-key header.',
    });
  }

  try {
    // 2. Resolve tenant from master DB (or in-memory cache)
    const tenantInfo = await resolveTenant(apiKey.trim());

    if (!tenantInfo) {
      logger.warn(`[TenantMiddleware] Unknown API key: ${apiKey}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key.',
      });
    }

    // 3. Get (or create) the tenant-scoped DB connection
    const tenantDb = getTenantDb(tenantInfo.databaseName);

    // 4. Attach to request for downstream use
    req.tenantInfo = tenantInfo;
    req.tenantDb = tenantDb;

    logger.info(
      `[TenantMiddleware] Resolved → "${tenantInfo.companyName}" [${tenantInfo.databaseName}]`
    );

    next();
  } catch (error) {
    logger.error(`[TenantMiddleware] Error during tenant resolution: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to resolve tenant.',
    });
  }
};
