import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  getStockProducts,
  createStockMovement,
  getProductStockMovements,
  getRecipeAnalysis,
  calculateRecipeProduction,
} from '../controllers/stock.controller'

const router = Router()

router.get('/', requireAuth, requirePermission('stock.view', 'pdv.view', 'interno.view', 'stock.quickBuy', 'buys.view', 'buys.manage'), getStockProducts)
router.post('/movements', requireAuth, requirePermission('stock.adjust'), createStockMovement)
router.get(
  '/:productId/movements',
  requireAuth,
  requirePermission('stock.view', 'pdv.view', 'interno.view', 'stock.quickBuy', 'buys.view', 'buys.manage'),
  getProductStockMovements
)
router.get(
  '/:productId/recipe-analysis',
  requireAuth,
  requirePermission('stock.view', 'pdv.view', 'interno.view', 'stock.quickBuy', 'buys.view', 'buys.manage'),
  getRecipeAnalysis
)
router.get(
  '/:productId/calculator',
  requireAuth,
  requirePermission('stock.view', 'pdv.view', 'interno.view', 'stock.quickBuy', 'buys.view', 'buys.manage'),
  calculateRecipeProduction
)

export default router
