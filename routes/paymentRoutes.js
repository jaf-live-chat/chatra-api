import express from 'express';

import { createHitpayCheckout } from '../controllers/paymentControllers.js';

const router = express.Router();

router.post('/checkout', createHitpayCheckout);

export default router;
