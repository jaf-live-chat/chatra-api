import express from 'express'
import {
  subscribeToPlan,
  triggerSubscriptionReminderByTenantId,
} from '../../controllers/master/subscriptionControllers.js'
import {
  singleTenantReminderValidator,
  subscribeToPlanValidator,
} from '../../validations/master/subscriptionValidator.js'
import { masterAdminAuth, protect } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.post(
  '/',
  subscribeToPlanValidator,
  subscribeToPlan
);

router.post(
  '/notification-reminders/:tenantId',
  protect,
  masterAdminAuth,
  singleTenantReminderValidator,
  triggerSubscriptionReminderByTenantId
);

export default router;