import express from 'express'
import {
  getTenantsByQuery
} from '../../controllers/master/tenantControllers.js'

import tenantAuth from '../../middlewares/tenantAuthMiddleware.js';

const router = express.Router();

router.get('/', tenantAuth, getTenantsByQuery);

export default router;