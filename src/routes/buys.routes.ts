import { Router } from 'express'
import {
  cancelBuyRequestController,
  clearBuyCartController,
  confirmBuyCartController,
  createBuyRequestController,
  getBuyCartController,
  getBuyRequestController,
  listBuyRequestsController,
  printBuyRequestShoppingListController,
  receiveBuyRequestController,
  removeBuyCartItemController,
  updateBuyCartController,
  upsertBuyCartItemController,
} from '../controllers/buys.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/cart', requireAuth, requirePermission('buys.view', 'buys.manage', 'stock.quickBuy'), getBuyCartController)
router.patch('/cart', requireAuth, requirePermission('buys.manage', 'stock.quickBuy'), updateBuyCartController)
router.put('/cart/items', requireAuth, requirePermission('buys.manage', 'stock.quickBuy'), upsertBuyCartItemController)
router.delete('/cart/items/:productId', requireAuth, requirePermission('buys.manage', 'stock.quickBuy'), removeBuyCartItemController)
router.delete('/cart', requireAuth, requirePermission('buys.manage', 'stock.quickBuy'), clearBuyCartController)
router.post('/cart/confirm', requireAuth, requirePermission('stock.purchase.create'), confirmBuyCartController)

router.get('/', requireAuth, requirePermission('buys.view', 'buys.manage', 'stock.purchase.create'), listBuyRequestsController)
router.post('/', requireAuth, requirePermission('stock.purchase.create'), createBuyRequestController)
router.get('/:id', requireAuth, requirePermission('buys.view', 'buys.manage', 'stock.purchase.create'), getBuyRequestController)
router.post('/:id/print-shopping-list', requireAuth, requirePermission('buys.view', 'buys.manage', 'stock.purchase.create'), printBuyRequestShoppingListController)
router.patch('/:id/receive', requireAuth, requirePermission('stock.purchase.create'), receiveBuyRequestController)
router.patch('/:id/cancel', requireAuth, requirePermission('buys.manage'), cancelBuyRequestController)

export default router
