import express from 'express';

import { createHitpayCheckout, getPaymentSetupStatus, getPayments } from '../controllers/paymentControllers.js';

const router = express.Router();

router.get('/', getPayments);
router.post('/checkout', createHitpayCheckout);
router.get('/status', getPaymentSetupStatus);

export default router;
