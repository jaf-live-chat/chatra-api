import express from 'express';

import { createHitpayCheckout, getPaymentSetupStatus } from '../controllers/paymentControllers.js';

const router = express.Router();

router.post('/checkout', createHitpayCheckout);
router.get('/status', getPaymentSetupStatus);

export default router;
