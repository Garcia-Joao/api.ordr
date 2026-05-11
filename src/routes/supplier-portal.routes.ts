import { Router } from 'express'
import {
  availabilityController,
  createPriceTableController,
  createPriceTableItemController,
  dashboardController,
  deletePriceTableController,
  deletePriceTableItemController,
  ordersController,
  priceTablesController,
  productsController,
  profileController,
  updatePriceTableController,
  updatePriceTableItemController,
  updateProfileController,
} from '../controllers/supplier-portal.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

router.get('/dashboard', dashboardController)
router.get('/profile', profileController)
router.patch('/profile', updateProfileController)
router.patch('/availability', availabilityController)

router.get('/products', productsController)
router.get('/orders', ordersController)

router.get('/price-tables', priceTablesController)
router.post('/price-tables', createPriceTableController)
router.patch('/price-tables/:tableId', updatePriceTableController)
router.delete('/price-tables/:tableId', deletePriceTableController)

router.post('/price-tables/:tableId/items', createPriceTableItemController)
router.patch('/price-tables/:tableId/items/:itemId', updatePriceTableItemController)
router.delete('/price-tables/:tableId/items/:itemId', deletePriceTableItemController)

export default router
