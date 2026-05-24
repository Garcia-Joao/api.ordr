import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  activateMenu,
  createMenu,
  deleteMenu,
  getActiveMenu,
  getMenu,
  listMenus,
  updateMenu,
} from '../controllers/menus.controller'

const router = Router()

router.get('/', requireAuth, requirePermission('products.view', 'pdv.view', 'interno.view', 'orders.create'), listMenus)
router.get('/active', requireAuth, requirePermission('products.view', 'pdv.view', 'interno.view', 'orders.create'), getActiveMenu)
router.get('/:id', requireAuth, requirePermission('products.view', 'pdv.view', 'interno.view', 'orders.create'), getMenu)
router.post('/', requireAuth, requirePermission('products.create'), createMenu)
router.patch('/:id', requireAuth, requirePermission('products.update'), updateMenu)
router.post('/:id/activate', requireAuth, requirePermission('products.update'), activateMenu)
router.delete('/:id', requireAuth, requirePermission('products.delete'), deleteMenu)

export default router
