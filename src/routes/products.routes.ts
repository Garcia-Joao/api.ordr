import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/products.controller'

const router = Router()

router.get('/', requireAuth, requirePermission('products.view', 'pdv.view', 'interno.view', 'orders.create', 'stock.view'), getProducts)
router.get('/:id', requireAuth, requirePermission('products.view', 'pdv.view', 'interno.view', 'orders.create', 'stock.view'), getProductById)
router.post('/', requireAuth, requirePermission('products.create'), createProduct)
router.patch('/:id', requireAuth, requirePermission('products.update'), updateProduct)
router.delete('/:id', requireAuth, requirePermission('products.delete'), deleteProduct)

export default router
