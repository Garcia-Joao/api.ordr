import { Router } from 'express'
import {
  createOrder,
  getOrders,
  cancelOrder,
  downloadOrdersReportPdf,
  getOrdersReportSummary,
  getInternalCustomerTodayOrders,
  payInternalCustomerTodayOrders,
  paySelectedInternalCustomerOrders,
  getInternalCustomerPendingOrders,
} from '../controllers/orders.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/', requireAuth, requirePermission('orders.view', 'pdv.view', 'interno.view'), getOrders)
router.post('/', requireAuth, requirePermission('orders.create'), createOrder)
router.patch('/:id/cancel', requireAuth, requirePermission('orders.cancel'), cancelOrder)

router.get(
  '/internal-customer/:internalCustomerId/today',
  requireAuth,
  requirePermission('internalCustomers.view', 'interno.view'),
  getInternalCustomerTodayOrders
)

router.post(
  '/internal-customer/:internalCustomerId/pay-today',
  requireAuth,
  requirePermission('internalCustomers.pay', 'interno.view'),
  payInternalCustomerTodayOrders
)

router.post(
  '/internal-customer/:internalCustomerId/pay-selected',
  requireAuth,
  requirePermission('internalCustomers.pay', 'interno.view'),
  paySelectedInternalCustomerOrders
)

router.get(
  '/internal-customer/:internalCustomerId/pending',
  requireAuth,
  requirePermission('internalCustomers.view', 'interno.view'),
  getInternalCustomerPendingOrders
)

router.get(
  '/report/pdf',
  requireAuth,
  requirePermission('reports.export'),
  downloadOrdersReportPdf
)
router.get(
  '/report/summary',
  requireAuth,
  requirePermission('reports.view'),
  getOrdersReportSummary
)

export default router
