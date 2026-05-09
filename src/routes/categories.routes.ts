import { Router } from 'express'
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/', requireAuth, requirePermission('categories.view', 'products.view', 'pdv.view', 'interno.view', 'orders.create'), getCategories)
router.get('/:id', requireAuth, requirePermission('categories.view', 'products.view', 'pdv.view', 'interno.view', 'orders.create'), getCategoryById)
router.post('/', requireAuth, requirePermission('categories.manage'), createCategory)
router.put('/:id', requireAuth, requirePermission('categories.manage'), updateCategory)
router.delete('/:id', requireAuth, requirePermission('categories.manage'), deleteCategory)

export default router
