import express from 'express'
import {
  getTenantsByQuery,
  updateTenantStatusById,
  deleteTenantById,
} from '../../controllers/master/tenantControllers.js'

import { masterAdminAuth, protect } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', protect, masterAdminAuth, getTenantsByQuery);
router.put('/:id/status', protect, masterAdminAuth, updateTenantStatusById);
router.delete('/:id', protect, masterAdminAuth, deleteTenantById);

export default router;