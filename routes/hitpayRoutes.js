import express from 'express';

import { getHitpayWebhookHealth, handleHitpayWebhook } from '../controllers/hitpayController.js';

const router = express.Router();

router.get('/hitpay/health', getHitpayWebhookHealth);
router.post('/hitpay', handleHitpayWebhook);

export default router;
