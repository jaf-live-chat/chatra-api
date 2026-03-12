import { TENANT_STATUS, SUBSCRIPTION_PLANS } from '../constants/constants.js';
import { logger } from '../utils/logger.js';

export const subscriptionMiddleware = (req, res, next) => {
  const { tenantInfo } = req;

  // Guard: tenantMiddleware must run before this
  if (!tenantInfo) {
    logger.error('[SubscriptionMiddleware] req.tenantInfo is undefined. Check middleware order.');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Tenant context not found. Ensure tenantMiddleware runs first.',
    });
  }

  // ── Rule 1: FREE_INTERNAL bypass 
  if (tenantInfo.subscriptionPlan === SUBSCRIPTION_PLANS.FREE_INTERNAL) {
    logger.info(
      `[SubscriptionMiddleware] FREE_INTERNAL tenant "${tenantInfo.companyName}" — subscription checks bypassed.`
    );
    return next();
  }

  // ── Rule 2: Account must be ACTIVATED
  if (tenantInfo.status !== TENANT_STATUS.ACTIVATED) {
    logger.warn(
      `[SubscriptionMiddleware] Blocked — tenant "${tenantInfo.companyName}" status: ${tenantInfo.status}`
    );
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `Your account is ${tenantInfo.status.toLowerCase()}. Please contact support.`,
      status: tenantInfo.status,
    });
  }

  // ── Rule 3: Subscription window must not have expired
  if (tenantInfo.subscriptionEnd && new Date() > new Date(tenantInfo.subscriptionEnd)) {
    logger.warn(
      `[SubscriptionMiddleware] Blocked — tenant "${tenantInfo.companyName}" subscription expired on ${tenantInfo.subscriptionEnd}`
    );
    return res.status(403).json({
      success: false,
      error: 'Subscription Expired',
      message: 'Your subscription has expired. Please renew to continue using JAF Chatra.',
      expiredAt: tenantInfo.subscriptionEnd,
    });
  }

  // All checks passed
  next();
};
