import { getMasterConnection } from "../../config/masterDB.js";
import { getSubscriptionModel } from "../../models/master/Subscriptions.js";
import { getTenantModel } from "../../models/master/Tenants.js";
import { getTenantConnection } from "../../config/tenantDB.js";
import { TENANT_STATUS } from "../../constants/constants.js";
import { formatDate } from "../../utils/dateFormatter.js";
import emailService from "../../utils/emailService.js";
import baseEmailTemplate from "../../templates/base-email/baseEmail.js";
import subscriptionReminderEmailTemplate from "../../templates/subscriptions/subscriptionReminderEmail.js";
import { NotFoundError } from "../../utils/errors.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getRemainingDays = (endDate) => {
  const today = toStartOfDay(new Date());
  const end = toStartOfDay(endDate);
  return Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
};

const getTenantEmailAddress = async (databaseName) => {
  if (!databaseName) {
    return "";
  }

  const { Agents } = getTenantConnection(databaseName);
  const adminAgent = await Agents.findOne({}, { emailAddress: 1, fullName: 1 })
    .sort({ createdAt: 1 })
    .lean();

  return {
    emailAddress: adminAgent?.emailAddress || "",
    adminName: adminAgent?.fullName || "Admin",
  };
};

const sendReminderEmail = async ({ subscription, tenant, remainingDays }) => {
  const { emailAddress, adminName } = await getTenantEmailAddress(tenant.databaseName);

  if (!emailAddress) {
    return {
      status: "SKIPPED",
      reason: "Tenant admin email not found",
      remainingDays,
    };
  }

  await emailService.sendEmail({
    to: emailAddress,
    subject: `Subscription reminder: ${remainingDays} day(s) remaining`,
    html: baseEmailTemplate(
      subscriptionReminderEmailTemplate({
        adminName,
        companyName: tenant.companyName,
        planName: subscription?.configuration?.planName || "Current Plan",
        remainingDays,
        subscriptionEnd: formatDate(subscription.subscriptionEnd, { isIncludeTime: true }),
      })
    ),
  });

  return {
    status: "SENT",
    remainingDays,
  };
};

const sendSubscriptionReminderNotificationByTenantId = async (tenantId) => {
  const { connection } = getMasterConnection();
  const Subscription = getSubscriptionModel(connection);
  const Tenant = getTenantModel(connection);

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const subscription = await Subscription.findOne({
    tenantId,
    status: TENANT_STATUS.ACTIVATED,
    subscriptionEnd: { $ne: null },
  })
    .sort({ subscriptionEnd: -1, createdAt: -1 })
    .lean();

  if (!subscription) {
    throw new NotFoundError("Active subscription with end date not found for tenant");
  }

  const remainingDays = getRemainingDays(subscription.subscriptionEnd);
  if (remainingDays < 0) {
    throw new NotFoundError("Subscription is already expired for tenant");
  }

  const outcome = await sendReminderEmail({
    subscription,
    tenant,
    remainingDays,
  });

  return {
    tenantId: tenant._id,
    companyName: tenant.companyName,
    subscriptionId: subscription._id,
    remainingDays: outcome.remainingDays,
    status: outcome.status,
    reason: outcome.reason || null,
  };
};

export default {
  sendSubscriptionReminderNotificationByTenantId,
};