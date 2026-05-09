import { Router } from 'express'
import {
  createCustomerController,
  deleteCustomerController,
  getCustomerController,
  listCustomersController,
  lookupCustomerByEventComandaController,
  removeEventCustomerComandaController,
  updateCustomerController,
  upsertEventCustomerComandaController,
} from '../controllers/customers.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/', requireAuth, requirePermission('customers.view'), listCustomersController)
router.get(
  '/lookup-by-comanda',
  requireAuth,
  requirePermission('customers.view', 'customers.eventComanda.manage', 'pdv.view', 'orders.create'),
  lookupCustomerByEventComandaController
)
router.post('/', requireAuth, requirePermission('customers.create'), createCustomerController)
router.post(
  '/event-comanda',
  requireAuth,
  requirePermission('customers.eventComanda.manage', 'customers.update', 'pdv.view', 'orders.create'),
  upsertEventCustomerComandaController
)
router.delete(
  '/event-comanda/:eventDateId/:customerId',
  requireAuth,
  requirePermission('customers.eventComanda.manage', 'customers.update'),
  removeEventCustomerComandaController
)
router.get('/:id', requireAuth, requirePermission('customers.view'), getCustomerController)
router.patch('/:id', requireAuth, requirePermission('customers.update'), updateCustomerController)
router.delete('/:id', requireAuth, requirePermission('customers.delete'), deleteCustomerController)

export default router
