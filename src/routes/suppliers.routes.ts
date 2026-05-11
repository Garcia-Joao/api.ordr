import { Router } from 'express'
import {
  createSupplierController,
  createSupplierPriceTableController,
  createSupplierPriceTableItemController,
  deleteSupplierController,
  deleteSupplierPriceTableController,
  deleteSupplierPriceTableItemController,
  getSupplierController,
  listSuppliersController,
  updateSupplierController,
  updateSupplierPriceTableController,
  updateSupplierPriceTableItemController,
} from '../controllers/suppliers.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/', requireAuth, requirePermission('suppliers.view', 'suppliers.manage'), listSuppliersController)
router.post('/', requireAuth, requirePermission('suppliers.manage'), createSupplierController)
router.get('/:id', requireAuth, requirePermission('suppliers.view', 'suppliers.manage'), getSupplierController)
router.patch('/:id', requireAuth, requirePermission('suppliers.manage'), updateSupplierController)
router.delete('/:id', requireAuth, requirePermission('suppliers.manage'), deleteSupplierController)

router.post('/:id/price-tables', requireAuth, requirePermission('suppliers.manage'), createSupplierPriceTableController)
router.patch('/:id/price-tables/:tableId', requireAuth, requirePermission('suppliers.manage'), updateSupplierPriceTableController)
router.delete('/:id/price-tables/:tableId', requireAuth, requirePermission('suppliers.manage'), deleteSupplierPriceTableController)

router.post('/:id/price-tables/:tableId/items', requireAuth, requirePermission('suppliers.manage'), createSupplierPriceTableItemController)
router.patch('/:id/price-tables/:tableId/items/:itemId', requireAuth, requirePermission('suppliers.manage'), updateSupplierPriceTableItemController)
router.delete('/:id/price-tables/:tableId/items/:itemId', requireAuth, requirePermission('suppliers.manage'), deleteSupplierPriceTableItemController)

export default router
