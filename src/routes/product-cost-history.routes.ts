import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import { getProductCostHistoryController } from '../controllers/product-cost-history.controller'

const router = Router()

router.get(
  '/',
  requireAuth,
  requirePermission('reports.view', 'products.cost.update', 'stock.view'),
  getProductCostHistoryController
)

export default router
