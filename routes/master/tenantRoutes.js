import express from 'express'
import {
  getTenantsByQuery,
  updateTenantStatusById,
  manageTenantSubscriptionById,
  deleteTenantById,
} from '../../controllers/master/tenantControllers.js'

import { masterAdminAuth, protect } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', protect, masterAdminAuth, getTenantsByQuery);
router.put('/:id/status', protect, masterAdminAuth, updateTenantStatusById);
router.patch('/:id/subscription', protect, masterAdminAuth, manageTenantSubscriptionById);
router.delete('/:id', protect, masterAdminAuth, deleteTenantById);

export default router;