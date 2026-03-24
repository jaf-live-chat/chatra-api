import express from 'express';

import { handleHitpayWebhook } from '../controllers/hitpayController.js';

const router = express.Router();

router.post('/hitpay', handleHitpayWebhook);

export default router;
