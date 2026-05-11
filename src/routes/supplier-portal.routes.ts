import { Router } from 'express'
import {
  availabilityController,
  bulkAdjustPriceTablePricesController,
  createPriceTableController,
  createPriceTableItemController,
  createPriceTableItemFromExistingController,
  dashboardController,
  deletePriceTableController,
  deletePriceTableItemController,
  duplicatePriceTableController,
  ordersController,
  priceTablesController,
  productsController,
  profileController,
  updatePriceTableController,
  updateItemStockController,
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
router.post('/price-tables/:tableId/duplicate', duplicatePriceTableController)
router.patch('/price-tables/:tableId/bulk-prices', bulkAdjustPriceTablePricesController)
router.delete('/price-tables/:tableId', deletePriceTableController)

router.post('/price-tables/:tableId/items', createPriceTableItemController)
router.post('/price-tables/:tableId/items/from-product', createPriceTableItemFromExistingController)
router.patch('/price-tables/:tableId/items/:itemId', updatePriceTableItemController)
router.patch('/price-tables/:tableId/items/:itemId/stock', updateItemStockController)
router.delete('/price-tables/:tableId/items/:itemId', deletePriceTableItemController)

export default router
