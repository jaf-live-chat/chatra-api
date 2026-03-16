import { logger } from '../../utils/logger.js';

import expressAsyncHandler from "express-async-handler";
import subscriptionServices from "../../services/master/subscriptionServices.js";
import toTitleCase from '../../utils/toTitleCase.js';

const subscribeToPlan = expressAsyncHandler(async (req, res) => {
  try {
    const subscriptionData = req.body?.subscriptionData || {};
    const agentData = req.body?.agentData || {};
    const paymentData = req.body?.paymentData || {};

    const {
      companyName,
      companyCode,
      subscriptionPlan,
      subscriptionStart,
      subscriptionEnd
    } = subscriptionData || {}

    const result = await subscriptionServices.subscribeTenantToPlan({
      companyName,
      companyCode,
      subscriptionPlan,
      subscriptionStart,
      subscriptionEnd,
      agentData,
      paymentData,
    });

    if (!result?.tenant || !result?.subscription || !result?.payment || !result?.agent) {
      throw new Error('Subscription service returned an invalid response');
    }

    const { tenant, subscription, payment, agent } = result;

    logger.info(`Created tenant: ${tenant._id} for company ${tenant.companyName}`);
    logger.info(`Created subscription for tenant ${tenant._id} with plan ${subscriptionPlan}`);
    logger.info(`Created payment ${payment._id} for subscription ${subscription._id}`);

    res.status(201).json({
      message: `${toTitleCase(companyName)} subscribed to ${toTitleCase(subscriptionPlan)} plan successfully`,
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

export {
  subscribeToPlan,
}