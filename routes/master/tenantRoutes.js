import express from 'express'
import {
  getTenantsByQuery,
  getSingleTenantById,
  updateTenantStatusById,
  manageTenantSubscriptionById,
  deleteTenantById,
} from '../../controllers/master/tenantControllers.js'

import { adminAuth, masterAdminAuth, protect } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', protect, masterAdminAuth, getTenantsByQuery);
router.get('/:id', protect, adminAuth, getSingleTenantById);
router.put('/:id/status', protect, masterAdminAuth, updateTenantStatusById);
router.patch('/:id/subscription', protect, masterAdminAuth, manageTenantSubscriptionById);
router.delete('/:id', protect, masterAdminAuth, deleteTenantById);

export default router;