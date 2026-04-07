import { logger } from '../../utils/logger.js';

import expressAsyncHandler from "express-async-handler";
import subscriptionServices from "../../services/master/subscriptionServices.js";
import subscriptionPlanServices from "../../services/master/subscriptionPlanServices.js";
import notificationReminderServices from "../../services/master/notificationReminderServices.js";
import toTitleCase from '../../utils/toTitleCase.js';
import generatePaymentReference from '../../utils/generatePaymentReference.js';
import calculateEndDate from '../../utils/calculateEndDate.js';

const subscribeToPlan = expressAsyncHandler(async (req, res) => {
  try {
    const subscriptionData = req.body?.subscriptionData || {};
    const agentData = req.body?.agentData || {};
    const paymentData = req.body?.paymentData || {};

    const {
      companyName,
      companyCode,
      subscriptionPlanId,
      subscriptionStart,
    } = subscriptionData || {}

    // Fetch the subscription plan to derive the payment amount
    const plan = await subscriptionPlanServices.getSubscriptionPlanById(subscriptionPlanId);

    const normalizedCompanyCode = String(companyCode || '').trim().toLowerCase();
    const resolvedSubscriptionEnd = calculateEndDate(
      subscriptionStart,
      plan?.billingCycle || 'monthly',
      plan?.interval || 1
    );

    const resolvedSubscriptionData = {
      companyName,
      companyCode: normalizedCompanyCode,
      subscriptionPlanId,
      subscriptionStart,
      subscriptionEnd: resolvedSubscriptionEnd,
    };

    // Generate payment reference if not provided; derive amount from plan
    const resolvedPaymentData = {
      ...paymentData,
      amount: plan?.price,
      referenceNumber: paymentData?.referenceNumber || generatePaymentReference(),
    };

    const result = await subscriptionServices.subscribeTenantToPlan({
      subscriptionData: resolvedSubscriptionData,
      agentData,
      paymentData: resolvedPaymentData,
    });

    if (!result?.tenant || !result?.subscription || !result?.payment || !result?.agent) {
      throw new Error('Subscription service returned an invalid response');
    }

    const { tenant, subscription, payment, agent } = result;

    logger.info(`Created tenant: ${tenant._id} for company ${tenant.companyName}`);
    logger.info(`Created subscription for tenant ${tenant._id} with plan ${subscriptionPlanId}`);
    logger.info(`Created payment ${payment._id} for subscription ${subscription._id}`);

    res.status(201).json({
      message: `${toTitleCase(companyName)} subscribed to ${toTitleCase(subscriptionPlanId)} plan successfully`,
      tenant: tenant?._id,
      subscription: subscription?._id,
      payment: payment?._id,
      agent: agent?._id,
    });

  } catch (error) {
    logger.error(`Error subscribing tenant to plan: ${error.message}`);
    throw new Error(`Failed to subscribe tenant to plan: ${error.message}`);
  }
})

const triggerSubscriptionReminderByTenantId = expressAsyncHandler(async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await notificationReminderServices.sendSubscriptionReminderNotificationByTenantId(tenantId);

    res.status(200).json({
      success: true,
      message: "Subscription reminder notification processed for tenant.",
      result,
    });
  } catch (error) {
    logger.error(`Error triggering tenant subscription reminder: ${error.message}`);
    throw error;
  }
});

export {
  subscribeToPlan,
  triggerSubscriptionReminderByTenantId,
}