import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  getSalesEnvironments,
  createSalesEnvironment,
  deleteSalesEnvironment,
} from '../controllers/sales-environments.controller'

const router = Router()

router.get(
  '/',
  requireAuth,
  requirePermission('salesEnvironments.view', 'pdv.view', 'interno.view', 'orders.create'),
  getSalesEnvironments
)
router.post(
  '/',
  requireAuth,
  requirePermission('salesEnvironments.manage'),
  createSalesEnvironment
)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('salesEnvironments.manage'),
  deleteSalesEnvironment
)

export default router
