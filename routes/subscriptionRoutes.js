import express from 'express'
import tenantControllers from '../controllers/subscriptionControllers.js'

const router = express.Router();

router.post('/', tenantControllers.subscribeToPlan);

export default router;