import express from 'express'
import { subscribeToPlan } from '../controllers/master/subscriptionControllers.js'
import { subscribeToPlanValidator } from '../validations/subscriptionValidator.js'

const router = express.Router();

router.post(
  '/',
  subscribeToPlanValidator,
  subscribeToPlan
);

export default router;