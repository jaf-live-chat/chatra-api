import { logger } from '../utils/logger.js';

import expressAsyncHandler from "express-async-handler";
import subscriptionServices from "../services/master/subscriptionServices.js";
import toTitleCase from '../utils/toTitleCase.js';

const subscribeToPlan = expressAsyncHandler(async (req, res) => {
  try {
    const subscriptionData = req.body?.subscriptionData || {};

    const {
      companyName,
      subscriptionPlan,
      subscriptionStart,
      subscriptionEnd
    } = subscriptionData || {}

    const result = await subscriptionServices.subscribeTenantToPlan({
      companyName,
      subscriptionPlan,
      subscriptionStart,
      subscriptionEnd
    });

    if (!result?.tenant || !result?.subscription) {
      throw new Error('Subscription service returned an invalid response');
    }

    const { tenant, subscription } = result;

    logger.info(`Created tenant: ${tenant._id} for company ${tenant.companyName}`);
    logger.info(`Created subscription for tenant ${tenant._id} with plan ${subscriptionPlan}`);

    res.status(201).json({
      message: `${toTitleCase(companyName)} subscribed to ${toTitleCase(subscriptionPlan)} plan successfully`,
      tenant: tenant?._id,
      subscription: subscription?._id,
    });

  } catch (error) {
    logger.error(`Error subscribing tenant to plan: ${error.message}`);
    throw new Error(`Failed to subscribe tenant to plan: ${error.message}`);
  }
})

export default {
  subscribeToPlan,
}